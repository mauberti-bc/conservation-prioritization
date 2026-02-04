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
  IDIR = 'idir',
  /**
   * Human users authenticating via Azure IDIR.
   */
  AZURE_IDIR = 'azureidir',
  /**
   * Database connection user
   */
  DATABASE = 'database',
  /**
   * Service accounts
   */
  SYSTEM = 'system'
}

/**
 * System roles
 *
 * @export
 * @enum {string}
 */
export enum SYSTEM_ROLE {
  ADMIN = 'admin',
  MEMBER = 'member'
}
