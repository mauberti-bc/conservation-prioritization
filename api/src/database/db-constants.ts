import SQL from 'sql-template-strings';
import { IDENTITY_SOURCE } from '../constants/database';
import { getLogger } from '../utils/logger'; // Move to top to avoid lazy loading
import { getAPIUserDBConnection } from './db'; // Same here, move to top for clarity

export type DBConstants = {
  serviceClientUsers: any[]; // Consider more specific typing than `any[]`
};

let DBConstants: DBConstants | undefined;

/**
 * Initializes the singleton DB constants instance used by the API.
 */
export const initDBConstants = async (): Promise<void> => {
  // Return early if already initialized
  if (DBConstants) return;

  const defaultLog = getLogger('database/db'); // Moved logger initialization up

  try {
    const connection = await getAPIUserDBConnection(); // Lazy loading removed for clarity

    // Open DB connection and execute query
    await connection.open();

    try {
      // Fetch the service account users
      const response = await connection.sql(selectServiceAccountsSqlStatement);
      DBConstants = { serviceClientUsers: response.rows };

      // Commit the transaction
      await connection.commit();
    } catch (error) {
      defaultLog.error({ label: 'initDBConstants', message: 'Error initializing DB constants', error });
      await connection.rollback(); // Ensure rollback in case of failure
      throw error; // Rethrow after logging and rollback
    } finally {
      connection.release(); // Ensure DB connection is released
    }
  } catch (error) {
    defaultLog.error({ label: 'initDBConstants', message: 'Failed to initialize DB constants', error });
    throw error; // Propagate error up
  }
};

/**
 * Returns the singleton DB constants instance.
 * @throws Will throw an error if DBConstants is not initialized.
 */
export const getDBConstants = (): DBConstants => {
  if (!DBConstants) {
    throw new Error('DBConstants is not initialized');
  }
  return DBConstants;
};

// Updated SQL statement to query the "profile" table based on IDENTITY_SOURCE
const selectServiceAccountsSqlStatement = SQL`
  SELECT *
  FROM "profile"
  WHERE identity_source = ${IDENTITY_SOURCE.SYSTEM};
`;
