import { SQL, SQLStatement } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateTaskTile, TaskTile, UpdateTaskTile } from '../models/task-tile';
import { BaseRepository } from './base-repository';

/**
 * Repository for CRUD operations on task tiles.
 *
 * @export
 * @class TaskTileRepository
 * @extends {BaseRepository}
 */
export class TaskTileRepository extends BaseRepository {
  /**
   * Creates a new task tile record.
   *
   * @param {CreateTaskTile} taskTile
   * @return {*}  {Promise<TaskTile>}
   * @memberof TaskTileRepository
   */
  async createTaskTile(taskTile: CreateTaskTile): Promise<TaskTile> {
    const sqlStatement = SQL`
      INSERT INTO task_tile (
        task_id,
        status,
        pmtiles_uri,
        content_type
      ) VALUES (
        ${taskTile.task_id},
        ${taskTile.status},
        ${taskTile.pmtiles_uri ?? null},
        ${taskTile.content_type ?? null}
      )
      RETURNING task_tile_id, task_id, status, pmtiles_uri, content_type, started_at, completed_at, failed_at, error_code, error_message
    `;

    const response = await this.connection.sql(sqlStatement, TaskTile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create task tile', [
        'TaskTileRepository->createTaskTile',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Updates a task tile record.
   *
   * @param {string} taskTileId
   * @param {UpdateTaskTile} updates
   * @return {*}  {Promise<TaskTile>}
   * @memberof TaskTileRepository
   */
  async updateTaskTile(taskTileId: string, updates: UpdateTaskTile): Promise<TaskTile> {
    const sqlStatement = SQL`UPDATE task_tile SET `;
    const updateFragments: SQLStatement[] = [];

    if (updates.status !== undefined) {
      updateFragments.push(SQL`status = ${updates.status}`);
    }

    if (updates.pmtiles_uri !== undefined) {
      updateFragments.push(SQL`pmtiles_uri = ${updates.pmtiles_uri}`);
    }

    if (updates.content_type !== undefined) {
      updateFragments.push(SQL`content_type = ${updates.content_type}`);
    }

    if (updates.error_code !== undefined) {
      updateFragments.push(SQL`error_code = ${updates.error_code}`);
    }

    if (updates.error_message !== undefined) {
      updateFragments.push(SQL`error_message = ${updates.error_message}`);
    }

    if (!updateFragments.length) {
      throw new ApiExecuteSQLError('No task tile updates provided', [
        'TaskTileRepository->updateTaskTile',
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
      WHERE task_tile_id = ${taskTileId}
      RETURNING task_tile_id, task_id, status, pmtiles_uri, content_type, started_at, completed_at, failed_at, error_code, error_message
    `);

    const response = await this.connection.sql(sqlStatement, TaskTile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update task tile', [
        'TaskTileRepository->updateTaskTile',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches a task tile by its ID.
   *
   * @param {string} taskTileId
   * @return {*}  {Promise<TaskTile>}
   * @memberof TaskTileRepository
   */
  async getTaskTileById(taskTileId: string): Promise<TaskTile> {
    const sqlStatement = SQL`
      SELECT task_tile_id, task_id, status, pmtiles_uri, content_type, started_at, completed_at, failed_at, error_code, error_message
      FROM task_tile
      WHERE task_tile_id = ${taskTileId}
    `;

    const response = await this.connection.sql(sqlStatement, TaskTile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to fetch task tile', [
        'TaskTileRepository->getTaskTileById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches the most recent task tile for a task.
   *
   * @param {string} taskId
   * @return {*}  {Promise<TaskTile | null>}
   * @memberof TaskTileRepository
   */
  async getLatestTaskTileByTaskId(taskId: string): Promise<TaskTile | null> {
    const sqlStatement = SQL`
      SELECT task_tile_id, task_id, status, pmtiles_uri, content_type, started_at, completed_at, failed_at, error_code, error_message
      FROM task_tile
      WHERE task_id = ${taskId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const response = await this.connection.sql(sqlStatement, TaskTile);

    if (response.rowCount < 1) {
      return null;
    }

    return response.rows[0];
  }
}
