import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  CreateTaskProfile,
  DeleteTaskProfile,
  TaskProfile,
  TaskProfileExtended,
  UpdateTaskProfile
} from '../models/task-profile';
import { BaseRepository } from './base-repository';

/**
 * Repository for CRUD operations on task profiles.
 *
 * @export
 * @class TaskProfileRepository
 * @extends {BaseRepository}
 */
export class TaskProfileRepository extends BaseRepository {
  /**
   * Create a new task profile association.
   *
   * @param {CreateTaskProfile} taskProfile
   * @return {Promise<TaskProfile>}
   * @memberof TaskProfileRepository
   */
  async createTaskProfile(taskProfile: CreateTaskProfile): Promise<TaskProfile> {
    const sqlStatement = SQL`
      INSERT INTO task_profile (task_id, profile_id)
      VALUES (${taskProfile.task_id}, ${taskProfile.profile_id})
      RETURNING task_profile_id, task_id, profile_id
    `;

    const response = await this.connection.sql(sqlStatement, TaskProfile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create task profile', [
        'TaskProfileRepository->createTaskProfile',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a task profile by its ID.
   *
   * @param {string} taskProfileId
   * @return {Promise<TaskProfile>}
   * @memberof TaskProfileRepository
   */
  async getTaskProfileById(taskProfileId: string): Promise<TaskProfile> {
    const sqlStatement = SQL`
      SELECT task_profile_id, task_id, profile_id
      FROM task_profile
      WHERE task_profile_id = ${taskProfileId}
      AND record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, TaskProfile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get task profile by ID', [
        'TaskProfileRepository->getTaskProfileById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get task profiles by task ID.
   *
   * @param {string} taskId
   * @return {Promise<TaskProfileExtended[]>}
   * @memberof TaskProfileRepository
   */
  async getTaskProfilesByTaskId(taskId: string): Promise<TaskProfileExtended[]> {
    const sqlStatement = SQL`
    SELECT ts.task_profile_id, ts.task_id, ts.profile_id, r.name as role_name
    FROM task_profile ts
    JOIN task_permission tperm ON tperm.task_id = ts.task_id AND tperm.profile_id = ts.profile_id
    JOIN role r ON r.role_id = tperm.role_id
    WHERE ts.task_id = ${taskId}
    AND ts.record_end_date IS NULL
    AND tperm.record_end_date IS NULL
    AND r.record_end_date IS NULL
  `;

    const response = await this.connection.sql(sqlStatement, TaskProfileExtended);

    if (response.rowCount && response.rowCount < 1) {
      throw new ApiExecuteSQLError('Failed to get task profiles by task ID', [
        'TaskProfileRepository->getTaskProfilesByTaskId',
        'Expected rowCount > 0'
      ]);
    }

    return response.rows;
  }

  /**
   * Get all task profiles.
   *
   * @return {Promise<TaskProfile[]>}
   * @memberof TaskProfileRepository
   */
  async getAllTaskProfiles(): Promise<TaskProfile[]> {
    const sqlStatement = SQL`
      SELECT task_profile_id, task_id, profile_id
      FROM task_profile
      WHERE record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, TaskProfile);

    return response.rows;
  }

  /**
   * Update an existing task profile.
   *
   * @param {string} taskProfileId
   * @param {UpdateTaskProfile} updates
   * @return {Promise<TaskProfile>}
   * @memberof TaskProfileRepository
   */
  async updateTaskProfile(taskProfileId: string, updates: UpdateTaskProfile): Promise<TaskProfile> {
    const sqlStatement = SQL`
      UPDATE task_profile
      SET
        task_id = COALESCE(${updates.task_id}, task_id),
        profile_id = COALESCE(${updates.profile_id}, profile_id)
      WHERE task_profile_id = ${taskProfileId}
      AND record_end_date IS NULL
      RETURNING task_profile_id, task_id, profile_id
    `;

    const response = await this.connection.sql(sqlStatement, TaskProfile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update task profile', [
        'TaskProfileRepository->updateTaskProfile',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete a task profile.
   *
   * @param {DeleteTaskProfile} data
   * @return {Promise<void>}
   * @memberof TaskProfileRepository
   */
  async deleteTaskProfile(data: DeleteTaskProfile): Promise<void> {
    const sqlStatement = SQL`
      UPDATE task_profile
      SET record_end_date = now()
      WHERE task_profile_id = ${data.task_profile_id}
      AND record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete task profile', [
        'TaskProfileRepository->deleteTaskProfile',
        'Expected rowCount = 1'
      ]);
    }
  }

  /**
   * Get the role name for a specific profile on a task.
   *
   * @param {string} taskId - The ID of the task.
   * @param {string} profileId - The ID of the profile.
   * @return {Promise<string | null>} - Returns the role name if found, otherwise null.
   * @memberof TaskProfileRepository
   */
  async getRoleForTaskProfile(taskId: string, profileId: string): Promise<string | null> {
    const sqlStatement = SQL`
      SELECT r.name as role_name
      FROM task_profile ts
      JOIN task_permission tperm ON tperm.task_id = ts.task_id AND tperm.profile_id = ts.profile_id
      JOIN role r ON r.role_id = tperm.role_id
      WHERE ts.task_id = ${taskId}
      AND ts.profile_id = ${profileId}
      AND ts.record_end_date IS NULL
      AND tperm.record_end_date IS NULL
      AND r.record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount && response.rowCount > 1) {
      throw new ApiExecuteSQLError('Multiple roles found for the same task-profile combination', [
        'TaskProfileRepository->getRoleForTaskProfile'
      ]);
    }

    return response.rows[0]?.role_name ?? null;
  }
}
