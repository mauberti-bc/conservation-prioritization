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
      WITH inserted AS (
        INSERT INTO profile (
          identity_source,
          profile_identifier,
          profile_guid,
          role_id,
          display_name,
          email,
          given_name,
          family_name,
          agency,
          notes
        ) VALUES (
          ${profile.identity_source},
          LOWER(${profile.profile_identifier}),
          LOWER(${profile.profile_guid}),
          ${profile.role_id},
          ${profile.display_name ?? null},
          ${profile.email ?? null},
          ${profile.given_name ?? null},
          ${profile.family_name ?? null},
          ${profile.agency ?? null},
          ${profile.notes ?? null}
        )
        RETURNING profile_id, identity_source, profile_identifier, profile_guid, role_id, display_name, email, given_name, family_name, agency, notes
      )
      SELECT
        inserted.profile_id,
        inserted.identity_source,
        inserted.profile_identifier,
        inserted.profile_guid,
        inserted.role_id,
        inserted.display_name,
        inserted.email,
        inserted.given_name,
        inserted.family_name,
        inserted.agency,
        inserted.notes,
        r.name as role_name
      FROM inserted
      LEFT JOIN role r ON r.role_id = inserted.role_id
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
        p.profile_id,
        p.identity_source,
        p.profile_identifier,
        p.profile_guid,
        p.role_id,
        p.display_name,
        p.email,
        p.given_name,
        p.family_name,
        p.agency,
        p.notes,
        r.name as role_name
      FROM
        profile p
      JOIN role r ON r.role_id = p.role_id
      WHERE
        p.profile_id = ${profileId}
      AND
        p.record_end_date IS NULL
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
  async findProfileByGuid(profileGuid: string): Promise<Profile | null> {
    const sqlStatement = SQL`
      SELECT
        p.profile_id,
        p.identity_source,
        p.profile_identifier,
        p.profile_guid,
        p.role_id,
        p.display_name,
        p.email,
        p.given_name,
        p.family_name,
        p.agency,
        p.notes,
        r.name as role_name
      FROM
        profile p
      JOIN role r ON r.role_id = p.role_id
      WHERE
        LOWER(p.profile_guid) = LOWER(${profileGuid})
      AND
        p.record_end_date IS NULL
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, Profile);

    return response.rows[0] ?? null;
  }

  /**
   * Fetches an active profile by identity source + profile identifier.
   *
   * @param {string} identitySource
   * @param {string} profileIdentifier
   * @return {*}  {Promise<Profile | null>}
   * @memberof ProfileRepository
   */
  async findProfileByIdentifier(identitySource: string, profileIdentifier: string): Promise<Profile | null> {
    const sqlStatement = SQL`
      SELECT
        p.profile_id,
        p.identity_source,
        p.profile_identifier,
        p.profile_guid,
        p.role_id,
        p.display_name,
        p.email,
        p.given_name,
        p.family_name,
        p.agency,
        p.notes,
        r.name as role_name
      FROM
        profile p
      JOIN role r ON r.role_id = p.role_id
      WHERE
        p.identity_source = ${identitySource}
      AND
        LOWER(p.profile_identifier) = LOWER(${profileIdentifier})
      AND
        p.record_end_date IS NULL
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, Profile);

    if (!response.rowCount) {
      return null;
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get profile by identifier', [
        'ProfileRepository->findProfileByIdentifier',
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
      WITH updated AS (
        UPDATE profile
        SET
          identity_source = COALESCE(${updates.identity_source}, identity_source),
          profile_identifier = COALESCE(LOWER(${updates.profile_identifier}), profile_identifier),
          profile_guid = COALESCE(LOWER(${updates.profile_guid}), profile_guid),
          role_id = COALESCE(${updates.role_id}, role_id),
          display_name = COALESCE(${updates.display_name}, display_name),
          email = COALESCE(${updates.email}, email),
          given_name = COALESCE(${updates.given_name}, given_name),
          family_name = COALESCE(${updates.family_name}, family_name),
          agency = COALESCE(${updates.agency}, agency),
          notes = COALESCE(${updates.notes}, notes)
        WHERE
          profile_id = ${profileId}
        AND
          record_end_date IS NULL
        RETURNING profile_id, identity_source, profile_identifier, profile_guid, role_id, display_name, email, given_name, family_name, agency, notes
      )
      SELECT
        updated.profile_id,
        updated.identity_source,
        updated.profile_identifier,
        updated.profile_guid,
        updated.role_id,
        updated.display_name,
        updated.email,
        updated.given_name,
        updated.family_name,
        updated.agency,
        updated.notes,
        r.name as role_name
      FROM updated
      JOIN role r ON r.role_id = updated.role_id
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

  /**
   * Fetches a role ID by role name.
   *
   * @param {string} roleName
   * @return {*}  {Promise<string>}
   * @memberof ProfileRepository
   */
  async getRoleIdByName(roleName: string): Promise<string> {
    const sqlStatement = SQL`
      SELECT role_id
      FROM role
      WHERE LOWER(name) = LOWER(${roleName})
      AND record_end_date IS NULL
      LIMIT 1
    `;

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to get role by name', [
        'ProfileRepository->getRoleIdByName',
        'Expected rowCount > 0'
      ]);
    }

    return response.rows[0].role_id as string;
  }

  /**
   * Fetches a role ID by role name and scope.
   *
   * @param {string} roleName
   * @param {string} roleScope
   * @return {*}  {Promise<string>}
   * @memberof ProfileRepository
   */
  async getRoleIdByNameAndScope(roleName: string, roleScope: string): Promise<string> {
    const sqlStatement = SQL`
      SELECT role_id
      FROM role
      WHERE LOWER(name) = LOWER(${roleName})
      AND LOWER(scope::text) = LOWER(${roleScope})
      AND record_end_date IS NULL
      LIMIT 1
    `;

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to get role by name and scope', [
        'ProfileRepository->getRoleIdByNameAndScope',
        'Expected rowCount > 0'
      ]);
    }

    return response.rows[0].role_id as string;
  }
}
