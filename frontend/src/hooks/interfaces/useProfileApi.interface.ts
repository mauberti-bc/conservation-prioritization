/**
 * Interface representing a user profile.
 */
export interface IProfile {
  profile_id: string; // UUID of the profile
  identity_source: string; // Identity source (e.g., 'SYSTEM', 'IDIR', 'DATABASE')
  profile_identifier: string; // Profile identifier (max length 200)
  profile_guid: string; // Profile GUID (max length 200)
  role_id?: number; // Optional numeric role ID
  role_name?: string; // Optional role name (max length 100)
}
