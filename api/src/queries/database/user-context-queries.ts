import { SQL, SQLStatement } from 'sql-template-strings';
import { IDENTITY_SOURCE } from '../../constants/database';

/**
 * Build a SQL statement to set the profile context for a given user.
 * Returns a SQLStatement or throws if invalid inputs are provided.
 *
 * @param {string} userGuid External identity provider GUID for the user.
 * @param {IDENTITY_SOURCE} systemUserType Identity source used to resolve the database profile context.
 * @returns {SQLStatement} Set profile context sql.
 * @throws {Error} setProfileContextSQL: userGuid is required.
 * @throws {Error} setProfileContextSQL: systemUserType is required.
 */
export const setProfileContextSQL = (userGuid: string, systemUserType: IDENTITY_SOURCE): SQLStatement => {
  if (!userGuid) {
    throw new Error('setProfileContextSQL: userGuid is required');
  }

  if (!systemUserType) {
    throw new Error('setProfileContextSQL: systemUserType is required');
  }

  // Use parameterized query to prevent SQL injection
  return SQL`SELECT api_set_context(${userGuid}, ${systemUserType}) AS api_set_context;`;
};
