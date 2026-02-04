import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  CreateProjectProfile,
  DeleteProjectProfile,
  ProjectProfile,
  ProjectProfileExtended,
  UpdateProjectProfile
} from '../models/project-profile';
import { BaseRepository } from './base-repository';

/**
 * Repository for interacting with the project_profile table in the database.
 *
 * @export
 * @class ProjectProfileRepository
 * @extends {BaseRepository}
 */
export class ProjectProfileRepository extends BaseRepository {
  /**
   * Creates a new project profile association.
   *
   * @param {CreateProjectProfile} projectProfile - The project profile data to insert.
   * @return {*}  {Promise<ProjectProfile>} The created project profile association.
   * @memberof ProjectProfileRepository
   */
  async createProjectProfile(projectProfile: CreateProjectProfile): Promise<ProjectProfile> {
    const sqlStatement = SQL`
      INSERT INTO project_profile (
        project_id,
        profile_id
      ) VALUES (
        ${projectProfile.project_id},
        ${projectProfile.profile_id}
      )
      RETURNING project_profile_id, project_id, profile_id, record_effective_date, record_end_date
    `;

    const response = await this.connection.sql(sqlStatement, ProjectProfile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create project profile', [
        'ProjectProfileRepository->createProjectProfile',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches a single active project profile by its ID.
   *
   * @param {string} projectProfileId - The UUID of the project profile.
   * @return {*}  {Promise<ProjectProfile>} The matching project profile.
   * @memberof ProjectProfileRepository
   */
  async getProjectProfileById(projectProfileId: string): Promise<ProjectProfile> {
    const sqlStatement = SQL`
      SELECT
        project_profile_id, project_id, profile_id, record_effective_date, record_end_date
      FROM
        project_profile
      WHERE
        project_profile_id = ${projectProfileId}
      AND
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, ProjectProfile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get project profile by id', [
        'ProjectProfileRepository->getProjectProfileById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get project profiles by project ID.
   *
   * @param {string} projectId
   * @return {Promise<ProjectProfileExtended[]>}
   * @memberof ProjectProfileRepository
   */
  async getProjectProfilesByProjectId(projectId: string): Promise<ProjectProfileExtended[]> {
    const sqlStatement = SQL`
      SELECT ts.project_profile_id, ts.project_id, ts.profile_id, r.name as role_name
      FROM project_profile ts
    JOIN project_permission tperm ON tperm.project_id = ts.project_id AND tperm.profile_id = ts.profile_id
    JOIN role r ON r.role_id = tperm.role_id
    WHERE ts.project_id = ${projectId}
    AND ts.record_end_date IS NULL
    AND tperm.record_end_date IS NULL
    AND r.record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, ProjectProfileExtended);

    if (response.rowCount && response.rowCount < 1) {
      throw new ApiExecuteSQLError('Failed to get project profiles by project ID', [
        'ProjectProfileRepository->getProjectProfilesByProjectId',
        'Expected rowCount > 0'
      ]);
    }

    return response.rows;
  }

  /**
   * Updates an existing project profile association.
   *
   * @param {string} projectProfileId - The UUID of the project profile to update.
   * @param {UpdateProjectProfile} updates - The fields to update.
   * @return {*}  {Promise<ProjectProfile>} The updated project profile.
   * @memberof ProjectProfileRepository
   */
  async updateProjectProfile(projectProfileId: string, updates: UpdateProjectProfile): Promise<ProjectProfile> {
    const sqlStatement = SQL`
      UPDATE project_profile
      SET
        project_id = COALESCE(${updates.project_id}, project_id),
        profile_id = COALESCE(${updates.profile_id}, profile_id)
      WHERE
        project_profile_id = ${projectProfileId}
      AND
        record_end_date IS NULL
      RETURNING project_profile_id, project_id, profile_id, record_effective_date, record_end_date
    `;

    const response = await this.connection.sql(sqlStatement, ProjectProfile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update project profile', [
        'ProjectProfileRepository->updateProjectProfile',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft deletes a project profile by setting its record end date.
   *
   * @param {DeleteProjectProfile} data - The data containing the project_profile_id to delete.
   * @return {*}  {Promise<void>} Resolves when the deletion is successful.
   * @memberof ProjectProfileRepository
   */
  async deleteProjectProfile(data: DeleteProjectProfile): Promise<void> {
    const sqlStatement = SQL`
      UPDATE project_profile
      SET
        record_end_date = now()
      WHERE
        project_profile_id = ${data.project_profile_id}
      AND
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete project profile', [
        'ProjectProfileRepository->deleteProjectProfile',
        'Expected rowCount = 1'
      ]);
    }
  }

  /**
   * Get the role name for a specific profile on a project.
   *
   * @param {string} projectId - The ID of the project.
   * @param {string} profileId - The ID of the profile.
   * @return {Promise<string | null>} - Returns the role name if found, otherwise null.
   * @memberof ProjectProfileRepository
   */
  async getRoleForProjectProfile(projectId: string, profileId: string): Promise<string | null> {
    const sqlStatement = SQL`
      SELECT r.name as role_name
      FROM project_profile ts
      JOIN project_permission tperm ON tperm.project_id = ts.project_id AND tperm.profile_id = ts.profile_id
      JOIN role r ON r.role_id = tperm.role_id
      WHERE ts.project_id = ${projectId}
      AND ts.profile_id = ${profileId}
      AND ts.record_end_date IS NULL
      AND tperm.record_end_date IS NULL
      AND r.record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount && response.rowCount > 1) {
      throw new ApiExecuteSQLError('Multiple roles found for the same project-profile combination', [
        'ProjectProfileRepository->getRoleForProjectProfile'
      ]);
    }

    return response.rows[0]?.role_name ?? null;
  }
}
