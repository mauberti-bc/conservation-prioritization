/**
 * The identity source of the authenticated user.
 *
 * @export
 * @enum {number}
 */
export enum IDENTITY_SOURCE {
  /**
   * Human users authenticating via IDIR.
   */
  IDIR = 'idir',
  /**
   * Database connection user
   */
  DATABASE = 'database',
  /**
   * Service accounts
   */
  SYSTEM = 'system'
}
