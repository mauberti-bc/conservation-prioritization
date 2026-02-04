import SQL from 'sql-template-strings';
import { z } from 'zod';
import { IDENTITY_SOURCE } from '../constants/database';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { Profile, ProfileExtended } from '../models/profile';
import { BaseRepository } from './base-repository';

/**
 * Maximum number of users to return in getAvailableUsers.
 */
const MAX_AVAILABLE_USERS_LIMIT = 50;

/**
 * A user available for team membership.
 */
export const AvailableUser = z.object({
  profile_id: z.number(),
  profile_identifier: z.string()
});

export type AvailableUser = z.infer<typeof AvailableUser>;

const SystemRoles = z.object({
  system_role_id: z.number(),
  name: z.string()
});

export type SystemRoles = z.infer<typeof SystemRoles>;

/**
 * Parameters for adding a new system user.
 */
export interface IAddProfileParams {
  userGuid: string;
  userIdentifier: string;
  identitySource: string;
  displayName?: string | null;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  agency?: string | null;
}

export class UserRepository extends BaseRepository {
  /**
   * Get all system roles in db
   *
   * @return {*}  {Promise<SystemRoles[]>}
   * @memberof UserRepository
   */
  async getRoles(): Promise<SystemRoles[]> {
    const sqlStatement = SQL`
      SELECT
        sr.system_role_id,
        sr.name
      FROM
        system_role sr
    `;

    const response = await this.connection.sql(sqlStatement, SystemRoles);

    return response.rows;
  }

  /**
   * Fetch a single system user by their system user ID.
   *
   * @param {number} systemUserId
   * @return {*}  {Promise<ProfileExtended>}
   * @memberof UserRepository
   */
  async getUserById(systemUserId: number): Promise<ProfileExtended> {
    const sqlStatement = SQL`
      SELECT
        su.*,
        uis.name AS identity_source,
        array_remove(array_agg(sr.system_role_id), NULL) AS role_ids,
        array_remove(array_agg(sr.name), NULL) AS role_names
      FROM
        "profile" su
      LEFT JOIN
        profile_role sur
      ON
        su.profile_id = sur.profile_id
      LEFT JOIN
        system_role sr
      ON
        sur.system_role_id = sr.system_role_id
      LEFT JOIN
        profile_identity_source uis
      ON
        uis.profile_identity_source_id = su.profile_identity_source_id
      WHERE
        su.profile_id = ${systemUserId}
      AND
        su.record_end_date IS NULL
      GROUP BY
        su.profile_id,
        su.profile_identity_source_id,
        su.profile_identifier,
        su.profile_guid,
        su.record_effective_date,
        su.record_end_date,
        su.created_at,
        su.create_user,
        su.updated_at,
        su.update_user,
        su.revision_count,
        su.display_name,
        su.given_name,
        su.family_name,
        su.email,
        su.agency,
        su.notes,
        uis.name;
    `;

    const response = await this.connection.sql(sqlStatement, ProfileExtended);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get user by id', [
        'UserRepository->getUserById',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get an existing system user by their GUID.
   *
   * @param {string} userGuid the user's GUID
   * @return {*}  {Promise<ProfileExtended>}
   * @memberof UserRepository
   */
  async getUserByGuid(userGuid: string): Promise<ProfileExtended[]> {
    const sqlStatement = SQL`
      SELECT
        su.*,
        uis.name AS identity_source,
        array_remove(array_agg(sr.system_role_id), NULL) AS role_ids,
        array_remove(array_agg(sr.name), NULL) AS role_names
      FROM
        "profile" su
      LEFT JOIN
        profile_role sur
      ON
        su.profile_id = sur.profile_id
      LEFT JOIN
        system_role sr
      ON
        sur.system_role_id = sr.system_role_id
      LEFT JOIN
        profile_identity_source uis
      ON
        uis.profile_identity_source_id = su.profile_identity_source_id
      WHERE
        su.profile_guid = ${userGuid}
      GROUP BY
        su.profile_id,
        su.profile_identity_source_id,
        su.profile_identifier,
        su.profile_guid,
        su.record_effective_date,
        su.record_end_date,
        su.created_at,
        su.create_user,
        su.updated_at,
        su.update_user,
        su.revision_count,
        su.display_name,
        su.given_name,
        su.family_name,
        su.email,
        su.agency,
        su.notes,
        uis.name;
    `;

    const response = await this.connection.sql(sqlStatement, ProfileExtended);

    return response.rows;
  }

  /**
   * Get an existing system user by their user identifier and identity source.
   *
   * @param userIdentifier the user's identifier
   * @param identitySource the user's identity source, e.g. `'IDIR'`
   * @return {*}  {Promise<ProfileExtended[]>} Promise resolving an array containing the user, if they match the
   * search criteria.
   * @memberof UserService
   */
  async getUserByIdentifier(userIdentifier: string, identitySource: string): Promise<ProfileExtended[]> {
    const sqlStatement = SQL`
      SELECT
        su.*,
        uis.name AS identity_source,
        array_remove(array_agg(sr.system_role_id), NULL) AS role_ids,
        array_remove(array_agg(sr.name), NULL) AS role_names
      FROM
        "profile" su
      LEFT JOIN
        profile_role sur
      ON
        su.profile_id = sur.profile_id
      LEFT JOIN
        system_role sr
      ON
        sur.system_role_id = sr.system_role_id
      LEFT JOIN
        profile_identity_source uis
      ON
        uis.profile_identity_source_id = su.profile_identity_source_id
      WHERE
        LOWER(su.profile_identifier) = ${userIdentifier.toLowerCase()}
      AND
        uis.name = ${identitySource.toUpperCase()}
      GROUP BY
        su.profile_id,
        su.profile_identity_source_id,
        su.profile_identifier,
        su.profile_guid,
        su.record_effective_date,
        su.record_end_date,
        su.created_at,
        su.create_user,
        su.updated_at,
        su.update_user,
        su.revision_count,
        su.display_name,
        su.given_name,
        su.family_name,
        su.email,
        su.agency,
        su.notes,
        uis.name;
    `;

    const response = await this.connection.sql(sqlStatement, ProfileExtended);

    return response.rows;
  }

  /**
   * Adds a new system user.
   *
   * Note: Will fail if the system user already exists.
   *
   * @param {IAddProfileParams} params - The user parameters
   * @return {*}  {Promise<Profile>}
   * @memberof UserRepository
   */
  async addProfile(params: IAddProfileParams): Promise<Profile> {
    const sqlStatement = SQL`
      INSERT INTO
        "profile"
      (
        profile_guid,
        profile_identity_source_id,
        profile_identifier,
        record_effective_date,
        display_name,
        email,
        given_name,
        family_name,
        agency
      )
      VALUES (
        ${params.userGuid},
        (
          SELECT
            profile_identity_source_id
          FROM
            profile_identity_source
          WHERE
            name = ${params.identitySource.toUpperCase()}
        ),
        ${params.userIdentifier},
        now(),
        ${params.displayName ?? null},
        ${params.email ?? null},
        ${params.givenName ?? null},
        ${params.familyName ?? null},
        ${params.agency ?? null}
      )
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement, Profile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert new user', [
        'UserRepository->addProfile',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a list of all system users.
   *
   * @return {*}  {Promise<ProfileExtended[]>}
   * @memberof UserRepository
   */
  async listProfiles(): Promise<ProfileExtended[]> {
    const sqlStatement = SQL`
      SELECT
        su.*,
        uis.name AS identity_source,
        array_remove(array_agg(sr.system_role_id), NULL) AS role_ids,
        array_remove(array_agg(sr.name), NULL) AS role_names
      FROM
        "profile" su
      LEFT JOIN
        profile_role sur
      ON
        su.profile_id = sur.profile_id
      LEFT JOIN
        system_role sr
      ON
        sur.system_role_id = sr.system_role_id
      LEFT JOIN
      	profile_identity_source uis
      ON
      	su.profile_identity_source_id = uis.profile_identity_source_id
      WHERE
        su.record_end_date IS NULL AND uis.name not in (${IDENTITY_SOURCE.DATABASE}, ${IDENTITY_SOURCE.SYSTEM})
      GROUP BY
        su.profile_id,
        su.profile_identity_source_id,
        su.profile_identifier,
        su.profile_guid,
        su.record_effective_date,
        su.record_end_date,
        su.created_at,
        su.create_user,
        su.updated_at,
        su.update_user,
        su.revision_count,
        su.display_name,
        su.given_name,
        su.family_name,
        su.email,
        su.agency,
        su.notes,
        uis.name;
    `;

    const response = await this.connection.sql(sqlStatement, ProfileExtended);

    return response.rows;
  }

  /**
   * Activates an existing system user that had been deactivated (soft deleted).
   *
   * @param {number} systemUserId
   * @memberof UserRepository
   */
  async activateProfile(systemUserId: number) {
    const sqlStatement = SQL`
      UPDATE
        "profile"
      SET
        record_end_date = NULL
      WHERE
        profile_id = ${systemUserId}
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to activate system user', [
        'UserRepository->activateProfile',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Deactivates an existing system user (soft delete).
   *
   * @param {number} systemUserId
   * @memberof UserRepository
   */
  async deactivateProfile(systemUserId: number) {
    const sqlStatement = SQL`
      UPDATE
        "profile"
      SET
        record_end_date = now()
      WHERE
        profile_id = ${systemUserId}
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to deactivate system user', [
        'UserRepository->deactivateProfile',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Delete all system roles for the user.
   *
   * @param {number} systemUserId
   * @memberof UserRepository
   */
  async deleteUserSystemRoles(systemUserId: number) {
    const sqlStatement = SQL`
      DELETE FROM
        profile_role
      WHERE
        profile_id = ${systemUserId}
      RETURNING
        *;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Adds the specified roleIds to the user.
   *
   * @param {number} systemUserId
   * @param {number[]} roleIds
   * @memberof UserRepository
   */
  async addUserSystemRoles(systemUserId: number, roleIds: number[]) {
    const sqlStatement = SQL`
      INSERT INTO profile_role (
        profile_id,
        system_role_id
      ) VALUES `;

    roleIds.forEach((roleId, index) => {
      sqlStatement.append(SQL`
        (${systemUserId},${roleId})
      `);

      if (index !== roleIds.length - 1) {
        sqlStatement.append(',');
      }
    });

    sqlStatement.append(';');

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to insert user system roles', [
        'UserRepository->addUserSystemRoles',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Get available users for team membership (excludes SYSTEM and DATABASE users).
   *
   * @param {string} [search] - Optional search term to filter by profile_identifier.
   * @return {Promise<AvailableUser[]>}
   * @memberof UserRepository
   */
  async getAvailableUsers(search?: string): Promise<AvailableUser[]> {
    const knex = getKnex();
    const query = knex
      .table('profile as su')
      .select(['su.profile_id', 'su.profile_identifier'])
      .innerJoin('profile_identity_source as uis', 'su.profile_identity_source_id', 'uis.profile_identity_source_id')
      .whereNull('su.record_end_date')
      .whereNotIn('uis.name', [IDENTITY_SOURCE.SYSTEM, IDENTITY_SOURCE.DATABASE])
      .orderBy('su.profile_identifier', 'asc')
      .limit(MAX_AVAILABLE_USERS_LIMIT);

    if (search?.trim()) {
      query.whereILike('su.profile_identifier', `%${search.trim()}%`);
    }

    const response = await this.connection.knex(query, AvailableUser);
    return response.rows;
  }

  /**
   * Updates a system user's profile fields.
   *
   * @param {number} systemUserId - The ID of the user to update
   * @param {string | null} displayName - User's display name
   * @param {string | null} email - User's email
   * @param {string | null} givenName - User's first name
   * @param {string | null} familyName - User's last name
   * @param {string | null} agency - User's organization (BCeID Business only)
   * @return {*}  {Promise<void>}
   * @memberof UserRepository
   */
  async updateProfileProfile(
    systemUserId: number,
    displayName: string | null,
    email: string | null,
    givenName: string | null,
    familyName: string | null,
    agency: string | null
  ): Promise<void> {
    const sqlStatement = SQL`
      UPDATE
        "profile"
      SET
        display_name = ${displayName},
        email = ${email},
        given_name = ${givenName},
        family_name = ${familyName},
        agency = ${agency}
      WHERE
        profile_id = ${systemUserId}
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update system user profile', [
        'UserRepository->updateProfileProfile',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }
}
