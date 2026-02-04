import SQL from 'sql-template-strings';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import { SystemUser } from '../repositories/user-repository';

export type DBConstants = {
  serviceClientUsers: SystemUser[];
};

// Singleton instance for DB constants
let DBConstants: DBConstants | undefined;

/**
 * Initializes the singleton DB constants instance used by the API.
 */
export const initDBConstants = async (): Promise<void> => {
  if (DBConstants) {
    // DB constants already initialized, nothing to do
    return;
  }

  // Lazy load logger to prevent circular dependencies
  const { getLogger } = await import('../utils/logger');
  const defaultLog = getLogger('database/db');

  try {
    // Lazy load DB connection to prevent circular dependencies
    const { getAPIUserDBConnection } = await import('./db');
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      // Query service account users
      const response = await connection.sql(selectServiceAccountsSqlStatement, SystemUser);

      DBConstants = { serviceClientUsers: response.rows };

      await connection.commit();
    } catch (error) {
      defaultLog.error({ label: 'initDBConstants', message: 'Error initializing DB constants', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    defaultLog.error({ label: 'initDBConstants', message: 'Failed to initialize DB constants', error });
    throw error;
  }
};

/**
 * Returns the singleton DB constants instance
 */
export const getDBConstants = (): DBConstants => {
  if (!DBConstants) {
    throw new Error('DBConstants is not initialized');
  }
  return DBConstants;
};

// Updated SQL statement to use "profile" table instead of "system_user"
const selectServiceAccountsSqlStatement = SQL`
  SELECT
    *
  FROM
    "profile"
  WHERE
    identity_source = ${SYSTEM_IDENTITY_SOURCE.SYSTEM};
`;
