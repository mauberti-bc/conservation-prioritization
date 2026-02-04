/**
 * The identity source of the authenticated user.
 *
 * @export
 * @enum {number}
 */
export enum SYSTEM_IDENTITY_SOURCE {
  /**
   * Human users authenticating via IDIR.
   */
  IDIR = 'IDIR',
  /**
   * Database connection user
   */
  DATABASE = 'DATABASE',
  /**
   * Service accounts
   */
  SYSTEM = 'SYSTEM'
}
