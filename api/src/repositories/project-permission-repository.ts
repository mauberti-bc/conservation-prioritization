import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  CreateProjectPermission,
  DeleteProjectPermission,
  ProjectPermission,
  UpdateProjectPermission
} from '../models/project-permission';
import { BaseRepository } from './base-repository';

/**
 * Repository for interacting with the project_permission table in the database.
 *
 * @export
 * @class ProjectPermissionRepository
 * @extends {BaseRepository}
 */
export class ProjectPermissionRepository extends BaseRepository {
  /**
   * Creates a new project permission scoped to a project and role.
   *
   * @param {CreateProjectPermission} projectPermission - The project permission data to insert.
   * @return {*}  {Promise<ProjectPermission>} The created project permission.
   * @memberof ProjectPermissionRepository
   */
  async createProjectPermission(projectPermission: CreateProjectPermission): Promise<ProjectPermission> {
    const sqlStatement = SQL`
      INSERT INTO project_permission (
        project_id,
        profile_id,
        role_id
      ) VALUES (
        ${projectPermission.project_id},
        ${projectPermission.profile_id},
        ${projectPermission.role_id}
      )
      RETURNING project_permission_id, project_id, profile_id, role_id
    `;

    const response = await this.connection.sql(sqlStatement, ProjectPermission);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create project permission', [
        'ProjectPermissionRepository->createProjectPermission',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches a single active project permission by its ID.
   *
   * @param {string} projectPermissionId - The UUID of the project permission.
   * @return {*}  {Promise<ProjectPermission>} The matching project permission.
   * @memberof ProjectPermissionRepository
   */
  async getProjectPermissionById(projectPermissionId: string): Promise<ProjectPermission> {
    const sqlStatement = SQL`
      SELECT
        project_permission_id, project_id, profile_id, role_id
      FROM
        project_permission
      WHERE
        project_permission_id = ${projectPermissionId}
      AND
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, ProjectPermission);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get project permission by id', [
        'ProjectPermissionRepository->getProjectPermissionById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches all active project permissions.
   *
   * @return {*}  {Promise<ProjectPermission[]>} List of active project permissions.
   * @memberof ProjectPermissionRepository
   */
  async getProjectPermissions(): Promise<ProjectPermission[]> {
    const sqlStatement = SQL`
      SELECT
        project_permission_id, project_id, profile_id, role_id
      FROM
        project_permission
      WHERE
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, ProjectPermission);

    return response.rows;
  }

  /**
   * Updates an existing project permission.
   *
   * @param {string} projectPermissionId - The UUID of the project permission to update.
   * @param {UpdateProjectPermission} updates - The fields to update.
   * @return {*}  {Promise<ProjectPermission>} The updated project permission.
   * @memberof ProjectPermissionRepository
   */
  async updateProjectPermission(
    projectPermissionId: string,
    updates: UpdateProjectPermission
  ): Promise<ProjectPermission> {
    const sqlStatement = SQL`
      UPDATE project_permission
      SET
        project_id = COALESCE(${updates.project_id}, project_id),
        profile_id = COALESCE(${updates.profile_id}, profile_id),
        role_id = COALESCE(${updates.role_id}, role_id)
      WHERE
        project_permission_id = ${projectPermissionId}
      AND
        record_end_date IS NULL
      RETURNING project_permission_id, project_id, profile_id, role_id
    `;

    const response = await this.connection.sql(sqlStatement, ProjectPermission);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update project permission', [
        'ProjectPermissionRepository->updateProjectPermission',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft deletes a project permission by setting its record end date.
   *
   * @param {DeleteProjectPermission} data - The data containing the project_permission_id to delete.
   * @return {*}  {Promise<void>} Resolves when the deletion is successful.
   * @memberof ProjectPermissionRepository
   */
  async deleteProjectPermission(data: DeleteProjectPermission): Promise<void> {
    const sqlStatement = SQL`
      UPDATE project_permission
      SET
        record_end_date = now()
      WHERE
        project_permission_id = ${data.project_permission_id}
      AND
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete project permission', [
        'ProjectPermissionRepository->deleteProjectPermission',
        'Expected rowCount = 1'
      ]);
    }
  }
}
