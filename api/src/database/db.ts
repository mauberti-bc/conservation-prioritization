import { Knex } from 'knex';
import pg from 'pg';
import { SQLStatement } from 'sql-template-strings';
import { z } from 'zod';
import { IDENTITY_SOURCE } from '../constants/database';
import { ApiExecuteSQLError, ApiGeneralError } from '../errors/api-error';
import { Profile } from '../models/profile';
import * as UserQueries from '../queries/database/user-context-queries';
import { getLogger } from '../utils/logger';
import { asyncErrorWrapper, syncErrorWrapper } from './db-utils';

const log = getLogger('database/db');

const DB_POOL_SIZE = 20;
const DB_CONNECTION_TIMEOUT = 0;
const DB_IDLE_TIMEOUT = 10000;
export const DB_CLIENT = 'pg';

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

export const defaultPoolConfig = getDbConfig();
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => v);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, parseFloat);

let DBPool: pg.Pool | undefined;
export const initDBPool = (config?: pg.PoolConfig) => {
  if (DBPool) return;
  log.debug({ label: 'initDBPool', message: 'Creating DB pool', config });
  DBPool = new pg.Pool(config || defaultPoolConfig);
};
export const getDBPool = (): pg.Pool => {
  if (!DBPool) throw new Error('DBPool is not initialized');
  return DBPool;
};

export interface IDBConnection {
  open: () => Promise<void>;
  release: () => void;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  query: <T extends pg.QueryResultRow = any>(text: string, values?: any[]) => Promise<pg.QueryResult<T>>;
  sql: <T extends pg.QueryResultRow = any>(
    statement: SQLStatement,
    schema?: z.Schema<T[]>
  ) => Promise<pg.QueryResult<T>>;
  knex: <T extends pg.QueryResultRow = any>(
    qb: Knex.QueryBuilder,
    schema?: z.Schema<T[]>
  ) => Promise<pg.QueryResult<T>>;
  systemUserId: () => string; // profile_guid
}

export const getDBConnection = <TUser extends Profile = Profile>({
  sub,
  identity_provider
}: {
  sub: string;
  identity_provider: IDENTITY_SOURCE;
}): IDBConnection => {
  if (!sub) throw new Error('User identifier is required');

  let client: pg.PoolClient;
  let isOpen = false;
  let isReleased = false;
  let systemUserId: string;

  const open = async () => {
    if (isOpen) return;
    client = await getDBPool().connect();
    isOpen = true;
    isReleased = false;

    await setUserContext();
    await client.query('BEGIN');
  };

  const release = () => {
    if (!isOpen || isReleased) return;
    client.release();
    isOpen = false;
    isReleased = true;
  };

  const commit = async () => {
    if (!isOpen) throw new Error('DBConnection not open');
    await client.query('COMMIT');
  };

  const rollback = async () => {
    if (!isOpen) throw new Error('DBConnection not open');
    await client.query('ROLLBACK');
  };

  const query = async <T extends pg.QueryResultRow = any>(text: string, values: any[] = []) =>
    client.query<T>(text, values);

  const sql = async <T extends pg.QueryResultRow = any>(statement: SQLStatement, schema?: z.Schema<T[]>) => {
    const start = Date.now();
    const result = await query<T>(statement.text, statement.values);
    log.silly({ label: 'sql', sql: statement.text, bindings: statement.values, duration: Date.now() - start });

    if (!schema || process.env.DATABASE_RESPONSE_VALIDATION_ENABLED !== 'true') return result;

    const parsed = schema.safeParse(result.rows);
    if (!parsed.success) throw new ApiExecuteSQLError('DB validation failed', parsed.error.errors);

    return result;
  };

  const knexQuery = async <T extends pg.QueryResultRow = any>(qb: Knex.QueryBuilder, schema?: z.Schema<T[]>) => {
    const { sql, bindings } = qb.toSQL().toNative();
    const result = await query<T>(sql, bindings as any[]);
    log.silly({ label: 'knex', sql, bindings });

    if (!schema || process.env.DATABASE_RESPONSE_VALIDATION_ENABLED !== 'true') return result;

    const parsed = schema.safeParse(result.rows);
    if (!parsed.success) throw new ApiExecuteSQLError('DB validation failed', parsed.error.errors);

    return result;
  };

  const setUserContext = async () => {
    const userGuid = sub; // already passed in
    const identitySource = identity_provider;

    if (!userGuid || !identitySource) throw new ApiGeneralError('Cannot determine user context');

    const statement = UserQueries.setProfileContextSQL(userGuid, identitySource);
    const response = await client.query<{ api_set_context: string }>(statement.text, statement.values);

    systemUserId = response.rows[0]?.api_set_context;
    if (!systemUserId) throw new ApiGeneralError('Failed to set user context');
  };

  const getSystemUserId = () => {
    if (!isOpen) throw new Error('DBConnection not open');
    return systemUserId;
  };

  return {
    open: asyncErrorWrapper(open),
    release: syncErrorWrapper(release),
    commit: asyncErrorWrapper(commit),
    rollback: asyncErrorWrapper(rollback),
    query: asyncErrorWrapper(query),
    sql: asyncErrorWrapper(sql),
    knex: asyncErrorWrapper(knexQuery),
    systemUserId: syncErrorWrapper(getSystemUserId)
  };
};

/** Type-safe DB connection factories */
export const getAPIUserDBConnection = (): IDBConnection =>
  getDBConnection({ sub: process.env.DB_USER_API!, identity_provider: IDENTITY_SOURCE.DATABASE });

export const getServiceAccountDBConnection = (systemUser: Profile): IDBConnection =>
  getDBConnection({ sub: systemUser.profile_guid, identity_provider: IDENTITY_SOURCE.SYSTEM });
