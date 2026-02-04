import { SQL, SQLStatement } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ApiPaginationOptions } from '../models/pagination';
import { CreateTask, DeleteTask, Task, UpdateTask, UpdateTaskExecution } from '../models/task';
import { BaseRepository } from './base-repository';

/**
 * Repository for managing task data.
 *
 * @export
 * @class TaskRepository
 * @extends {BaseRepository}
 */
export class TaskRepository extends BaseRepository {
  /**
   * Creates a new task record.
   *
   * @param {CreateTask} task - The data to insert into the task table.
   * @return {*} {Promise<Task>} The newly created task record.
   * @memberof TaskRepository
   */
  async createTask(task: CreateTask): Promise<Task> {
    const sqlStatement = SQL`
      INSERT INTO task (
        name,
        description,
        resolution,
        resampling,
        variant,
        status
      ) VALUES (
        ${task.name},
        ${task.description},
        ${task.resolution ?? null},
        ${task.resampling ?? null},
        ${task.variant ?? null},
        ${task.status}
      )
      RETURNING task_id, name, description, resolution, resampling, variant, tileset_uri, output_uri, status, status_message, prefect_flow_run_id, prefect_deployment_id
    `;

    const response = await this.connection.sql(sqlStatement, Task);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create task', ['TaskRepository->createTask', 'Expected rowCount = 1']);
    }

    return response.rows[0];
  }

  /**
   * Fetches a task by its ID.
   *
   * @param {string} taskId - The UUID of the task.
   * @return {*} {Promise<Task>} The task with the provided ID.
   * @memberof TaskRepository
   */
  async getTaskById(taskId: string): Promise<Task> {
    const sqlStatement = SQL`
      SELECT
        task_id, name, description, resolution, resampling, variant, tileset_uri, output_uri, status, status_message, prefect_flow_run_id, prefect_deployment_id
      FROM
        task
      WHERE
        task_id = ${taskId}
      AND
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, Task);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get task by id', [
        'TaskRepository->getTaskById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches a task by its ID, returning null if not found.
   *
   * @param {string} taskId - The UUID of the task.
   * @return {*} {Promise<Task | null>} The task if found, otherwise null.
   * @memberof TaskRepository
   */
  async findTaskById(taskId: string): Promise<Task | null> {
    const sqlStatement = SQL`
      SELECT
        task_id, name, description, resolution, resampling, variant, tileset_uri, output_uri, status, status_message, prefect_flow_run_id, prefect_deployment_id
      FROM
        task
      WHERE
        task_id = ${taskId}
      AND
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, Task);

    if (response.rowCount !== 1) {
      return null;
    }

    return response.rows[0];
  }

  /**
   * Fetches all tasks with a specific `record_end_date` set to `NULL`.
   *
   * @return {*} {Promise<Task[]>} A list of tasks.
   * @memberof TaskRepository
   */
  async getAllTasks(): Promise<Task[]> {
    const sqlStatement = SQL`
      SELECT
        task_id, name, description, tileset_uri, output_uri, status, status_message, prefect_flow_run_id, prefect_deployment_id
      FROM
        task
      WHERE
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, Task);

    return response.rows;
  }

  /**
   * Fetches tasks available to a profile ID via task permissions.
   *
   * @param {string} profileId
   * @return {*}  {Promise<Task[]>}
   * @memberof TaskRepository
   */
  async getTasksByProfileId(profileId: string): Promise<Task[]> {
    const sqlStatement = SQL`
      SELECT
        t.task_id,
        t.name,
        t.description,
        t.resolution,
        t.resampling,
        t.variant,
        t.tileset_uri,
        t.output_uri,
        t.status,
        t.status_message,
        t.prefect_flow_run_id,
        t.prefect_deployment_id
      FROM task t
      JOIN task_profile tp ON tp.task_id = t.task_id
      JOIN task_permission tperm ON tperm.task_id = t.task_id AND tperm.profile_id = tp.profile_id
      JOIN role r ON r.role_id = tperm.role_id
      WHERE tp.profile_id = ${profileId}
      AND tp.record_end_date IS NULL
      AND tperm.record_end_date IS NULL
      AND r.record_end_date IS NULL
      AND t.record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, Task);

    return response.rows;
  }

  /**
   * Fetches tasks available to a profile ID via task permissions with pagination.
   *
   * @param {string} profileId
   * @param {ApiPaginationOptions} pagination
   * @return {*}  {Promise<{ tasks: Task[]; total: number }>}
   * @memberof TaskRepository
   */
  async getTasksByProfileIdPaginated(
    profileId: string,
    pagination: ApiPaginationOptions
  ): Promise<{ tasks: Task[]; total: number }> {
    const sortField = this.resolveTaskSortField(pagination.sort);
    const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';
    const offset = (pagination.page - 1) * pagination.limit;

    const countStatement = SQL`
      SELECT COUNT(*)::int AS total
      FROM task t
      JOIN task_profile tp ON tp.task_id = t.task_id
      JOIN task_permission tperm ON tperm.task_id = t.task_id AND tperm.profile_id = tp.profile_id
      JOIN role r ON r.role_id = tperm.role_id
      WHERE tp.profile_id = ${profileId}
      AND tp.record_end_date IS NULL
      AND tperm.record_end_date IS NULL
      AND r.record_end_date IS NULL
      AND t.record_end_date IS NULL
    `;

    const countResponse = await this.connection.sql(countStatement);
    const total = countResponse.rows?.[0]?.total ?? 0;

    const sqlStatement = SQL`
      SELECT
        t.task_id,
        t.name,
        t.description,
        t.resolution,
        t.resampling,
        t.variant,
        t.tileset_uri,
        t.output_uri,
        t.status,
        t.status_message,
        t.prefect_flow_run_id,
        t.prefect_deployment_id
      FROM task t
      JOIN task_profile tp ON tp.task_id = t.task_id
      JOIN task_permission tperm ON tperm.task_id = t.task_id AND tperm.profile_id = tp.profile_id
      JOIN role r ON r.role_id = tperm.role_id
      WHERE tp.profile_id = ${profileId}
      AND tp.record_end_date IS NULL
      AND tperm.record_end_date IS NULL
      AND r.record_end_date IS NULL
      AND t.record_end_date IS NULL
    `;

    sqlStatement.append(` ORDER BY ${sortField} ${sortOrder}`);
    sqlStatement.append(SQL` LIMIT ${pagination.limit} OFFSET ${offset}`);

    const response = await this.connection.sql(sqlStatement, Task);

    return {
      tasks: response.rows,
      total
    };
  }

  /**
   * Resolve a safe task sort field from the provided sort key.
   *
   * @param {string | undefined} sort
   * @return {*}  {string}
   * @memberof TaskRepository
   */
  private resolveTaskSortField(sort?: string): string {
    if (sort === 'created_at') {
      return 't.created_at';
    }

    return 't.created_at';
  }

  /**
   * Fetches tasks associated with a project.
   *
   * @param {string} projectId
   * @return {*}  {Promise<Task[]>}
   * @memberof TaskRepository
   */
  async getTasksByProjectId(projectId: string): Promise<Task[]> {
    const sqlStatement = SQL`
      SELECT
        t.task_id,
        t.name,
        t.description,
        t.tileset_uri,
        t.output_uri,
        t.status,
        t.status_message,
        t.prefect_flow_run_id,
        t.prefect_deployment_id
      FROM task t
      JOIN project_task pt ON pt.task_id = t.task_id
      WHERE pt.project_id = ${projectId}
      AND t.record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, Task);

    return response.rows;
  }

  /**
   * Updates an existing task record.
   *
   * @param {string} taskId - The UUID of the task to update.
   * @param {UpdateTask} updates - The fields to update in the task record.
   * @return {*} {Promise<Task>} The updated task.
   * @memberof TaskRepository
   */
  async updateTask(taskId: string, updates: UpdateTask): Promise<Task> {
    const sqlStatement = SQL`
      UPDATE task
      SET
        name = COALESCE(${updates.name}, name),
        description = COALESCE(${updates.description}, description),
        resolution = COALESCE(${updates.resolution}, resolution),
        resampling = COALESCE(${updates.resampling}, resampling),
        variant = COALESCE(${updates.variant}, variant)
      WHERE
        task_id = ${taskId}
      AND
        record_end_date IS NULL
      RETURNING task_id, name, description, resolution, resampling, variant, tileset_uri, output_uri, status, status_message, prefect_flow_run_id, prefect_deployment_id
    `;

    const response = await this.connection.sql(sqlStatement, Task);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update task', ['TaskRepository->updateTask', 'Expected rowCount = 1']);
    }

    return response.rows[0];
  }

  /**
   * Soft deletes a task by setting its `record_end_date`.
   *
   * @param {DeleteTask} data - The data for the task to delete.
   * @return {*} {Promise<void>} Resolves when the task is successfully deleted.
   * @memberof TaskRepository
   */
  async deleteTask(data: DeleteTask): Promise<void> {
    const sqlStatement = SQL`
      UPDATE task
      SET
        record_end_date = now()
      WHERE
        task_id = ${data.task_id}
      AND
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete task', ['TaskRepository->deleteTask', 'Expected rowCount = 1']);
    }
  }

  /**
   * Updates task execution metadata like status and Prefect IDs.
   *
   * @param {string} taskId - The UUID of the task to update.
   * @param {UpdateTaskExecution} updates - The execution metadata to update.
   * @return {*} {Promise<Task>} The updated task.
   * @memberof TaskRepository
   */
  async updateTaskExecution(taskId: string, updates: UpdateTaskExecution): Promise<Task> {
    const sqlStatement = SQL`UPDATE task SET `;
    const updateFragments: SQLStatement[] = [];

    if (updates.status !== undefined) {
      updateFragments.push(SQL`status = ${updates.status}`);
    }

    if (updates.status_message !== undefined) {
      updateFragments.push(SQL`status_message = ${updates.status_message}`);
    }

    if (updates.prefect_flow_run_id !== undefined) {
      updateFragments.push(SQL`prefect_flow_run_id = ${updates.prefect_flow_run_id}`);
    }

    if (updates.prefect_deployment_id !== undefined) {
      updateFragments.push(SQL`prefect_deployment_id = ${updates.prefect_deployment_id}`);
    }

    if (updates.tileset_uri !== undefined) {
      updateFragments.push(SQL`tileset_uri = ${updates.tileset_uri}`);
    }

    if (updates.output_uri !== undefined) {
      updateFragments.push(SQL`output_uri = ${updates.output_uri}`);
    }

    if (!updateFragments.length) {
      throw new ApiExecuteSQLError('No task execution metadata provided to update', [
        'TaskRepository->updateTaskExecution',
        'Expected at least one update field'
      ]);
    }

    updateFragments.forEach((fragment, index) => {
      if (index > 0) {
        sqlStatement.append(SQL`, `);
      }
      sqlStatement.append(fragment);
    });

    sqlStatement.append(SQL`
      WHERE
        task_id = ${taskId}
      AND
        record_end_date IS NULL
      RETURNING task_id, name, description, resolution, resampling, variant, tileset_uri, output_uri, status, status_message, prefect_flow_run_id, prefect_deployment_id
    `);

    const response = await this.connection.sql(sqlStatement, Task);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update task execution metadata', [
        'TaskRepository->updateTaskExecution',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
}
