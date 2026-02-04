import { SQL } from 'sql-template-strings';
import { IDBConnection } from '../database/db';
import type { TaskTile } from '../models/task-tile';
import { TaskTileRepository } from '../repositories/task-tile-repository';
import { DBService } from './db-service';
import { TaskService } from './task-service';

/**
 * Service for managing task tile records.
 *
 * @export
 * @class TaskTileService
 * @extends {DBService}
 */
export class TaskTileService extends DBService {
  private taskTileRepository: TaskTileRepository;
  private taskService: TaskService;

  /**
   * Creates an instance of TaskTileService.
   *
   * @param {IDBConnection} connection - The database connection object.
   * @memberof TaskTileService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.taskTileRepository = new TaskTileRepository(connection);
    this.taskService = new TaskService(connection);
  }

  /**
   * Creates a draft task tile record.
   *
   * @param {string} taskId
   * @return {*}  {Promise<TaskTile>}
   * @memberof TaskTileService
   */
  async createDraftTileRecord(taskId: string): Promise<TaskTile> {
    return this.taskTileRepository.createTaskTile({
      task_id: taskId,
      status: 'DRAFT',
      uri: null,
      content_type: null
    });
  }

  /**
   * Marks a task tile as started.
   *
   * @param {string} taskTileId
   * @return {*}  {Promise<TaskTile>}
   * @memberof TaskTileService
   */
  async markTileStarted(taskTileId: string): Promise<TaskTile> {
    await this.connection.sql(SQL`UPDATE task_tile SET started_at = now() WHERE task_tile_id = ${taskTileId}`);
    return this.taskTileRepository.updateTaskTile(taskTileId, { status: 'STARTED' });
  }

  /**
   * Marks a task tile as completed and updates the task tileset URI.
   *
   * @param {string} taskTileId
   * @param {string} uri
   * @param {string | null} [contentType]
   * @return {*}  {Promise<TaskTile>}
   * @memberof TaskTileService
   */
  async markTileCompleted(taskTileId: string, uri: string, contentType?: string | null): Promise<TaskTile> {
    await this.connection.sql(SQL`UPDATE task_tile SET completed_at = now() WHERE task_tile_id = ${taskTileId}`);

    const updatedTile = await this.taskTileRepository.updateTaskTile(taskTileId, {
      status: 'COMPLETED',
      uri,
      content_type: contentType ?? null
    });

    await this.taskService.updateTaskExecution(updatedTile.task_id, { tileset_uri: uri });

    return updatedTile;
  }

  /**
   * Marks a task tile as failed with an optional error message.
   *
   * @param {string} taskTileId
   * @param {string | null} [errorCode]
   * @param {string | null} [errorMessage]
   * @return {*}  {Promise<TaskTile>}
   * @memberof TaskTileService
   */
  async markTileFailed(taskTileId: string, errorCode?: string | null, errorMessage?: string | null): Promise<TaskTile> {
    await this.connection.sql(SQL`UPDATE task_tile SET failed_at = now() WHERE task_tile_id = ${taskTileId}`);
    return this.taskTileRepository.updateTaskTile(taskTileId, {
      status: 'FAILED',
      error_code: errorCode ?? null,
      error_message: errorMessage ?? null
    });
  }
}
