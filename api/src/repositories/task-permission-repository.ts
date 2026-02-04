import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  CreateTaskPermission,
  DeleteTaskPermission,
  TaskPermission,
  UpdateTaskPermission
} from '../models/task-permission';
import { BaseRepository } from './base-repository';

/**
 * Repository for CRUD operations on task permissions.
 *
 * @export
 * @class TaskPermissionRepository
 * @extends {BaseRepository}
 */
export class TaskPermissionRepository extends BaseRepository {
  /**
   * Create a new task permission scoped to a task and role.
   *
   * @param {CreateTaskPermission} permission
   * @return {*}  {Promise<TaskPermission>}
   * @memberof TaskPermissionRepository
   */
  async createTaskPermission(permission: CreateTaskPermission): Promise<TaskPermission> {
    const sqlStatement = SQL`
      INSERT INTO task_permission (task_id, profile_id, role_id)
      VALUES (${permission.task_id}, ${permission.profile_id}, ${permission.role_id})
      RETURNING task_permission_id, task_id, profile_id, role_id
    `;

    const response = await this.connection.sql(sqlStatement, TaskPermission);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create task permission', [
        'TaskPermissionRepository->createTaskPermission',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a task permission by its ID.
   *
   * @param {string} taskPermissionId
   * @return {*}  {Promise<TaskPermission>}
   * @memberof TaskPermissionRepository
   */
  async getTaskPermissionById(taskPermissionId: string): Promise<TaskPermission> {
    const sqlStatement = SQL`
      SELECT task_permission_id, task_id, profile_id, role_id
      FROM task_permission
      WHERE task_permission_id = ${taskPermissionId}
      AND record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, TaskPermission);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get task permission by ID', [
        'TaskPermissionRepository->getTaskPermissionById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all active task permissions.
   *
   * @return {*}  {Promise<TaskPermission[]>}
   * @memberof TaskPermissionRepository
   */
  async getAllTaskPermissions(): Promise<TaskPermission[]> {
    const sqlStatement = SQL`
      SELECT task_permission_id, task_id, profile_id, role_id
      FROM task_permission
      WHERE record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, TaskPermission);

    return response.rows;
  }

  /**
   * Update an existing task permission.
   *
   * @param {string} taskPermissionId
   * @param {UpdateTaskPermission} updates
   * @return {*}  {Promise<TaskPermission>}
   * @memberof TaskPermissionRepository
   */
  async updateTaskPermission(taskPermissionId: string, updates: UpdateTaskPermission): Promise<TaskPermission> {
    const sqlStatement = SQL`
      UPDATE task_permission
      SET
        task_id = COALESCE(${updates.task_id}, task_id),
        profile_id = COALESCE(${updates.profile_id}, profile_id),
        role_id = COALESCE(${updates.role_id}, role_id)
      WHERE task_permission_id = ${taskPermissionId}
      AND record_end_date IS NULL
      RETURNING task_permission_id, task_id, profile_id, role_id
    `;

    const response = await this.connection.sql(sqlStatement, TaskPermission);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update task permission', [
        'TaskPermissionRepository->updateTaskPermission',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete a task permission.
   *
   * @param {DeleteTaskPermission} data
   * @return {*}  {Promise<void>}
   * @memberof TaskPermissionRepository
   */
  async deleteTaskPermission(data: DeleteTaskPermission): Promise<void> {
    const sqlStatement = SQL`
      UPDATE task_permission
      SET record_end_date = now()
      WHERE task_permission_id = ${data.task_permission_id}
      AND record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete task permission', [
        'TaskPermissionRepository->deleteTaskPermission',
        'Expected rowCount = 1'
      ]);
    }
  }
}
