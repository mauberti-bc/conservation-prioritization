import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
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
        status
      ) VALUES (
        ${task.name},
        ${task.description},
        ${task.status}
      )
      RETURNING task_id, name, description, status, status_message, prefect_flow_run_id, prefect_deployment_id
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
        task_id, name, description, status, status_message, prefect_flow_run_id, prefect_deployment_id
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
   * Fetches all tasks with a specific `record_end_date` set to `NULL`.
   *
   * @return {*} {Promise<Task[]>} A list of tasks.
   * @memberof TaskRepository
   */
  async getAllTasks(): Promise<Task[]> {
    const sqlStatement = SQL`
      SELECT
        task_id, name, description, status, status_message, prefect_flow_run_id, prefect_deployment_id
      FROM
        task
      WHERE
        record_end_date IS NULL
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
        description = COALESCE(${updates.description}, description)
      WHERE
        task_id = ${taskId}
      AND
        record_end_date IS NULL
      RETURNING task_id, name, description, status, status_message, prefect_flow_run_id, prefect_deployment_id
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
      RETURNING task_id, name, description, status, status_message, prefect_flow_run_id, prefect_deployment_id
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
