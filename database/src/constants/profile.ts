/**
 * The identity source of the authenticated user.
 *
 * @export
 * @enum {string}
 */
export enum IDENTITY_SOURCE {
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

/**
 * System roles
 *
 * @export
 * @enum {string}
 */
export enum SYSTEM_ROLE {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER'
}
