import knex, { Knex } from 'knex';
import * as pg from 'pg';
import { SQLStatement } from 'sql-template-strings';
import { z } from 'zod';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import { ApiExecuteSQLError, ApiGeneralError } from '../errors/api-error';
import * as UserQueries from '../queries/database/user-context-queries';
import { SystemUser } from '../repositories/user-repository';
import { getUserGuid, getUserIdentitySource } from '../utils/keycloak-utils';
import { getLogger } from '../utils/logger';
import { asyncErrorWrapper, syncErrorWrapper } from './db-utils';

const log = getLogger('database/db');

const DB_POOL_SIZE = 20;
const DB_CONNECTION_TIMEOUT = 0;
const DB_IDLE_TIMEOUT = 10000;

export const DB_CLIENT = 'pg';

const getDbConfig = () => ({
  user: process.env.DB_USER_API,
  password: process.env.DB_USER_API_PASS,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT),
  host: process.env.DB_HOST,
  max: DB_POOL_SIZE,
  connectionTimeoutMillis: DB_CONNECTION_TIMEOUT,
  idleTimeoutMillis: DB_IDLE_TIMEOUT
});

export const defaultPoolConfig: pg.PoolConfig = getDbConfig();

// Configure PostgreSQL type parsers
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => v);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, parseFloat);

let DBPool: pg.Pool | undefined;

export const initDBPool = (poolConfig?: pg.PoolConfig) => {
  if (DBPool) {
    return;
  }
  log.debug({ label: 'create db pool', message: 'pool config', poolConfig });
  try {
    DBPool = new pg.Pool(poolConfig);
  } catch (error) {
    log.error({ label: 'create db pool', message: 'failed to create db pool', error });
    throw error;
  }
};

export const getDBPool = () => DBPool;

export interface IDBConnection {
  open: () => Promise<void>;
  release: () => void;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  query: <T extends pg.QueryResultRow = any>(text: string, values?: any[]) => Promise<pg.QueryResult<T>>;
  sql: <T extends pg.QueryResultRow = any>(sql: SQLStatement, schema?: z.Schema<T>) => Promise<pg.QueryResult<T>>;
  knex: <T extends pg.QueryResultRow = any>(
    queryBuilder: Knex.QueryBuilder,
    schema?: z.Schema<T>
  ) => Promise<pg.QueryResult<T>>;
  systemUserId: () => number;
}

export const getDBConnection = (keycloakToken: object): IDBConnection => {
  if (!keycloakToken) throw new Error('Keycloak token is undefined');

  let client: pg.PoolClient;
  let isOpen = false;
  let isReleased = false;
  let systemUserId: number | null = null;

  const open = async () => {
    if (isOpen) {
      return;
    }

    const pool = getDBPool();
    if (!pool) {
      throw new Error('DBPool is not initialized');
    }

    client = await pool.connect();
    isOpen = true;
    isReleased = false;

    await setUserContext();
    await client.query('BEGIN');
  };

  const release = () => {
    if (!isOpen || isReleased) {
      return;
    }
    client.release();
    isOpen = false;
    isReleased = true;
  };

  const commit = async () => {
    if (!isOpen) {
      throw new Error('DBConnection is not open');
    }
    await client.query('COMMIT');
  };

  const rollback = async () => {
    if (!isOpen) {
      throw new Error('DBConnection is not open');
    }
    await client.query('ROLLBACK');
  };

  const query = async <T extends pg.QueryResultRow = any>(text: string, values?: any[]) => {
    if (!isOpen) {
      throw new Error('DBConnection is not open');
    }
    return client.query<T>(text, values || []);
  };

  const sql = async <T extends pg.QueryResultRow = any>(sqlStatement: SQLStatement, schema?: z.Schema<T>) => {
    const start = Date.now();
    const result = await query(sqlStatement.text, sqlStatement.values);
    log.silly({ label: 'sql', sql: sqlStatement.text, bindings: sqlStatement.values, duration: Date.now() - start });

    if (!schema || process.env.DATABASE_RESPONSE_VALIDATION_ENABLED !== 'true') return result;

    const parsed =
      schema instanceof z.ZodObject
        ? z.strictObject({ rows: z.array(schema.strict()) }).safeParse({ rows: result.rows })
        : z.strictObject({ rows: z.array(schema) }).safeParse({ rows: result.rows });

    if (!parsed.success) throw new ApiExecuteSQLError('Failed to validate database response', parsed.error.errors);
    return result;
  };

  const knexQuery = async <T extends pg.QueryResultRow = any>(qb: Knex.QueryBuilder, schema?: z.Schema<T>) => {
    const { sql, bindings } = qb.toSQL().toNative();
    const result = await query(sql, bindings as any[]);
    log.silly({ label: 'knex', sql, bindings });
    if (!schema || process.env.DATABASE_RESPONSE_VALIDATION_ENABLED !== 'true') return result;

    const parsed =
      schema instanceof z.ZodObject
        ? z.strictObject({ rows: z.array(schema.strict()) }).safeParse({ rows: result.rows })
        : z.object({ rows: z.array(schema) }).safeParse({ rows: result.rows });

    if (!parsed.success) throw new ApiExecuteSQLError('Failed to validate database response', parsed.error.errors);
    return result;
  };

  const getSystemUserID = () => {
    if (!isOpen) {
      throw new Error('DBConnection is not open');
    }
    return systemUserId as number;
  };

  const setUserContext = async () => {
    const userGuid = getUserGuid(keycloakToken);
    const identitySource = getUserIdentitySource(keycloakToken);
    if (!userGuid || !identitySource) throw new ApiGeneralError('Failed to identify authenticated user');

    const sqlStatement = UserQueries.setSystemUserContextSQL(userGuid, identitySource);
    if (!sqlStatement) throw new ApiExecuteSQLError('Failed to build SQL user context statement');

    const response = await client.query(sqlStatement.text, sqlStatement.values);
    systemUserId = response?.rows?.[0].api_set_context;
  };

  return {
    open: asyncErrorWrapper(open),
    release: syncErrorWrapper(release),
    commit: asyncErrorWrapper(commit),
    rollback: asyncErrorWrapper(rollback),
    query: asyncErrorWrapper(query),
    sql: asyncErrorWrapper(sql),
    knex: asyncErrorWrapper(knexQuery),
    systemUserId: syncErrorWrapper(getSystemUserID)
  };
};

export const getAPIUserDBConnection = (): IDBConnection =>
  getDBConnection({
    preferred_username: `${process.env.DB_USER_API}@${SYSTEM_IDENTITY_SOURCE.DATABASE}`,
    identity_provider: SYSTEM_IDENTITY_SOURCE.DATABASE
  });

export const getServiceAccountDBConnection = (systemUser: SystemUser): IDBConnection =>
  getDBConnection({
    preferred_username: systemUser.user_guid,
    identity_provider: SYSTEM_IDENTITY_SOURCE.SYSTEM
  });

export const getKnexQueryBuilder = <TRecord extends {} = any, TResult = Record<string, any>[]>(): Knex.QueryBuilder<
  TRecord,
  TResult
> => knex<TRecord, TResult>({ client: DB_CLIENT }).queryBuilder();

export const getKnex = <TRecord extends {} = any, TResult = Record<string, any>[]>(): Knex<TRecord, TResult> =>
  knex<TRecord, TResult>({ client: DB_CLIENT });
