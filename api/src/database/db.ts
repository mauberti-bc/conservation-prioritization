import { Knex } from 'knex';
import pg from 'pg';
import { SQLStatement } from 'sql-template-strings';
import { z } from 'zod';
import { IDENTITY_SOURCE } from '../constants/database';
import { ApiExecuteSQLError, ApiGeneralError } from '../errors/api-error';
import { Profile } from '../models/profile';
import * as UserQueries from '../queries/database/user-context-queries';
import { getUserGuid, getUserIdentitySource } from '../utils/keycloak-utils';
import { getLogger } from '../utils/logger';
import { asyncErrorWrapper, syncErrorWrapper } from './db-utils';

/**
 * Database logger instance
 */
const log = getLogger('database/db');

/**
 * Database pool configuration constants
 */
const DB_POOL_SIZE = 20;
const DB_CONNECTION_TIMEOUT = 0;
const DB_IDLE_TIMEOUT = 10000;

/**
 * Database client identifier
 */
export const DB_CLIENT = 'pg';

/**
 * Builds the default PostgreSQL pool configuration
 *
 * @return {*}  {pg.PoolConfig}
 */
const getDbConfig = (): pg.PoolConfig => ({
  user: process.env.DB_USER_API,
  password: process.env.DB_USER_API_PASS,
  database: process.env.DB_DATABASE,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  max: DB_POOL_SIZE,
  connectionTimeoutMillis: DB_CONNECTION_TIMEOUT,
  idleTimeoutMillis: DB_IDLE_TIMEOUT
});

/**
 * Default pool configuration
 */
export const defaultPoolConfig = getDbConfig();

/**
 * PostgreSQL type parsers to preserve raw values
 */
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => v);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, parseFloat);

/**
 * Singleton PostgreSQL connection pool
 */
let DBPool: pg.Pool | undefined;

/**
 * Initializes the PostgreSQL connection pool
 *
 * @param {pg.PoolConfig} [config]
 */
export const initDBPool = (config?: pg.PoolConfig) => {
  if (DBPool) {
    return;
  }

  log.debug({ label: 'initDBPool', message: 'Creating DB pool', config });
  DBPool = new pg.Pool(config || defaultPoolConfig);
};

/**
 * Returns the initialized PostgreSQL connection pool
 *
 * @return {*}  {pg.Pool}
 */
export const getDBPool = (): pg.Pool => {
  if (!DBPool) {
    throw new Error('DBPool is not initialized');
  }

  return DBPool;
};

/**
 * Interface describing a database connection wrapper
 */
export interface IDBConnection {
  open: () => Promise<void>;
  openWithoutTransaction: () => Promise<void>;
  release: () => void;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  query: <T extends pg.QueryResultRow = any>(text: string, values?: any[]) => Promise<pg.QueryResult<T>>;
  sql: <T extends pg.QueryResultRow = any>(
    statement: SQLStatement,
    ZodSchema?: z.ZodSchema<T, any, any>
  ) => Promise<pg.QueryResult<T>>;
  knex: <T extends pg.QueryResultRow = any>(
    qb: Knex.QueryBuilder,
    ZodSchema?: z.ZodSchema<T, any, any>
  ) => Promise<pg.QueryResult<T>>;
  systemUserId: () => string;
}

/**
 * Creates a database connection scoped to a user context
 *
 * @param {{
 *   sub: string;
 *   identity_provider: IDENTITY_SOURCE;
 * }} params
 *
 * @return {*}  {IDBConnection}
 */
export const getDBConnection = (keycloakToken: Record<string, any>): IDBConnection => {
  if (!keycloakToken) {
    throw new Error('Keycloak token is undefined');
  }

  const userGuid = getUserGuid(keycloakToken);
  const identitySource = getUserIdentitySource(keycloakToken);

  if (!userGuid) {
    throw new Error('User identifier is required');
  }

  let client: pg.PoolClient;
  let isOpen = false;
  let isReleased = false;
  let systemUserId: string;

  /**
   * Opens the database connection and starts a transaction
   */
  const open = async () => {
    if (isOpen) {
      return;
    }

    client = await getDBPool().connect();
    isOpen = true;
    isReleased = false;

    await client.query('BEGIN');
    await setUserContext();
  };

  /**
   * Opens the database connection without starting a transaction
   */
  const openWithoutTransaction = async () => {
    if (isOpen) {
      return;
    }

    client = await getDBPool().connect();
    isOpen = true;
    isReleased = false;

    await setUserContext();
  };

  /**
   * Releases the database connection back to the pool
   */
  const release = () => {
    if (!isOpen || isReleased) {
      return;
    }

    client.release();
    isOpen = false;
    isReleased = true;
  };

  /**
   * Commits the current transaction
   */
  const commit = async () => {
    if (!isOpen) {
      throw new Error('DBConnection not open');
    }

    await client.query('COMMIT');
  };

  /**
   * Rolls back the current transaction
   */
  const rollback = async () => {
    if (!isOpen) {
      throw new Error('DBConnection not open');
    }

    await client.query('ROLLBACK');
  };

  /**
   * Executes a raw SQL query
   *
   * @template T
   * @param {string} text
   * @param {any[]} [values]
   * @return {*}  {Promise<pg.QueryResult<T>>}
   */
  const query = async <T extends pg.QueryResultRow = any>(text: string, values: any[] = []) => {
    return client.query<T>(text, values);
  };

  /**
   * Executes a SQL template string with optional Zod validation
   *
   * @template T
   * @param {SQLStatement} statement
   * @param {z.Schema<T[]>} [schema]
   * @return {*}  {Promise<pg.QueryResult<T>>}
   */
  const sql = async <T extends pg.QueryResultRow = any>(
    statement: SQLStatement,
    zodSchema?: z.ZodSchema<T, any, any>
  ) => {
    const start = Date.now();
    const result = await query<T>(statement.text, statement.values);

    log.silly({
      label: 'sql',
      sql: statement.text,
      bindings: statement.values,
      duration: Date.now() - start
    });

    if (!zodSchema || process.env.DATABASE_RESPONSE_VALIDATION_ENABLED !== 'true') {
      return result;
    }

    const parsed = zodSchema.safeParse(result.rows);
    if (!parsed.success) {
      throw new ApiExecuteSQLError('DB validation failed', parsed.error.errors);
    }

    return result;
  };

  /**
   * Executes a Knex query builder with optional Zod validation
   *
   * @template T
   * @param {Knex.QueryBuilder} qb
   * @param {z.Schema<T[]>} [schema]
   * @return {*}  {Promise<pg.QueryResult<T>>}
   */
  const knexQuery = async <T extends pg.QueryResultRow = any>(
    qb: Knex.QueryBuilder,
    zodSchema?: z.ZodSchema<T, any, any>
  ) => {
    const { sql, bindings } = qb.toSQL().toNative();
    const result = await query<T>(sql, bindings as any[]);

    log.silly({ label: 'knex', sql, bindings });

    if (!zodSchema || process.env.DATABASE_RESPONSE_VALIDATION_ENABLED !== 'true') {
      return result;
    }

    const parsed = zodSchema.safeParse(result.rows);
    if (!parsed.success) {
      throw new ApiExecuteSQLError('DB validation failed', parsed.error.errors);
    }

    return result;
  };

  /**
   * Sets the database user context using the current identity
   */
  const setUserContext = async () => {
    if (!userGuid || !identitySource) {
      throw new ApiGeneralError('Cannot determine user context');
    }

    const statement = UserQueries.setProfileContextSQL(userGuid, identitySource);
    const response = await client.query<{ api_set_context: string }>(statement.text, statement.values);

    systemUserId = response.rows[0]?.api_set_context;

    if (!systemUserId) {
      throw new ApiGeneralError('Failed to set user context');
    }
  };

  /**
   * Returns the system user ID for the current connection
   *
   * @return {*}  {string}
   */
  const getSystemUserId = () => {
    if (!isOpen) {
      throw new Error('DBConnection not open');
    }

    return systemUserId;
  };

  return {
    open: asyncErrorWrapper(open),
    openWithoutTransaction: asyncErrorWrapper(openWithoutTransaction),
    release: syncErrorWrapper(release),
    commit: asyncErrorWrapper(commit),
    rollback: asyncErrorWrapper(rollback),
    query: asyncErrorWrapper(query),
    sql: asyncErrorWrapper(sql),
    knex: asyncErrorWrapper(knexQuery),
    systemUserId: syncErrorWrapper(getSystemUserId)
  };
};

/**
 * Returns a database connection scoped to the API service account
 *
 * @return {*}  {IDBConnection}
 */
export const getAPIUserDBConnection = (): IDBConnection => {
  return getDBConnection({
    preferred_username: `${process.env.DB_USER_API}@${IDENTITY_SOURCE.DATABASE}`,
    identity_provider: IDENTITY_SOURCE.DATABASE
  } as Record<string, any>);
};

/**
 * Returns a database connection scoped to a system user profile
 *
 * @param {Profile} systemUser
 * @return {*}  {IDBConnection}
 */
export const getServiceAccountDBConnection = (systemUser: Profile): IDBConnection => {
  return getDBConnection({
    preferred_username: `${systemUser.profile_guid}@${IDENTITY_SOURCE.SYSTEM}`,
    identity_provider: IDENTITY_SOURCE.SYSTEM
  } as Record<string, any>);
};
