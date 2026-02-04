import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateProfile, DeleteProfile, Profile, UpdateProfile } from '../models/profile';
import { BaseRepository } from './base-repository';

/**
 * Repository for interacting with the profile table in the database.
 *
 * @export
 * @class ProfileRepository
 * @extends {BaseRepository}
 */
export class ProfileRepository extends BaseRepository {
  /**
   * Creates a new profile record.
   *
   * @param {CreateProfile} profile
   *   The profile data to insert (profile_id is excluded).
   *
   * @return {*}  {Promise<Profile>}
   *   The newly created profile.
   *
   * @memberof ProfileRepository
   */
  async createProfile(profile: CreateProfile): Promise<Profile> {
    const sqlStatement = SQL`
      INSERT INTO profile (
        identity_source,
        profile_identifier,
        profile_guid,
        role_id,
        role_name
      ) VALUES (
        ${profile.identity_source},
        ${profile.profile_identifier},
        ${profile.profile_guid},
        ${profile.role_id},
        ${profile.role_name}
      )
      RETURNING profile_id, identity_source, profile_identifier, profile_guid, role_id, role_name
    `;

    const response = await this.connection.sql(sqlStatement, Profile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create profile', [
        'ProfileRepository->createProfile',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches a single active profile by its profile ID.
   *
   * @param {string} profileId
   *   The UUID of the profile.
   *
   * @return {*}  {Promise<Profile>}
   *   The matching profile.
   *
   * @memberof ProfileRepository
   */
  async getProfileById(profileId: string): Promise<Profile> {
    const sqlStatement = SQL`
      SELECT
        profile_id, identity_source, profile_identifier, profile_guid, role_id, role_name
      FROM
        profile
      WHERE
        profile_id = ${profileId}
      AND
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, Profile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get profile by id', [
        'ProfileRepository->getProfileById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches active profiles matching the supplied profile GUID.
   *
   * @param {string} profileGuid
   *   The globally unique identifier for the profile.
   *
   * @return {*}  {Promise<Profile>}
   *   A list of matching profiles.
   *
   * @memberof ProfileRepository
   */
  async getProfileByGuid(profileGuid: string): Promise<Profile> {
    const sqlStatement = SQL`
      SELECT
        profile_id, identity_source, profile_identifier, profile_guid, role_id, role_name
      FROM
        profile
      WHERE
        profile_guid = ${profileGuid}
      AND
        record_end_date IS NULL
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, Profile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get profile by GUID', [
        'ProfileRepository->getProfileByGuid',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Updates an existing active profile.
   *
   * Only supplied fields will be updated; all others remain unchanged.
   * Audit fields are managed by database triggers.
   *
   * @param {string} profileId
   *   The UUID of the profile to update.
   *
   * @param {UpdateProfile} updates
   *   The profile fields to update.
   *
   * @return {*}  {Promise<Profile>}
   *   The updated profile.
   *
   * @memberof ProfileRepository
   */
  async updateProfile(profileId: string, updates: UpdateProfile): Promise<Profile> {
    const sqlStatement = SQL`
      UPDATE profile
      SET
        identity_source = COALESCE(${updates.identity_source}, identity_source),
        profile_identifier = COALESCE(${updates.profile_identifier}, profile_identifier),
        profile_guid = COALESCE(${updates.profile_guid}, profile_guid),
        role_id = COALESCE(${updates.role_id}, role_id),
        role_name = COALESCE(${updates.role_name}, role_name)
      WHERE
        profile_id = ${profileId}
      AND
        record_end_date IS NULL
      RETURNING profile_id, identity_source, profile_identifier, profile_guid, role_id, role_name
    `;

    const response = await this.connection.sql(sqlStatement, Profile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update profile', [
        'ProfileRepository->updateProfile',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft deletes an active profile by setting its record end date.
   *
   * @param {DeleteProfile} data
   *   The data containing the profile_id to delete.
   *
   * @return {*}  {Promise<void>}
   *
   * @memberof ProfileRepository
   */
  async deleteProfile(data: DeleteProfile): Promise<void> {
    const sqlStatement = SQL`
      UPDATE profile
      SET
        record_end_date = now()
      WHERE
        profile_id = ${data.profile_id}
      AND
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete profile', [
        'ProfileRepository->deleteProfile',
        'Expected rowCount = 1'
      ]);
    }
  }
}
