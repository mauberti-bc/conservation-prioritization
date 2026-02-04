import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateTaskLayer, DeleteTaskLayer, TaskLayer } from '../models/task-layer';
import { BaseRepository } from './base-repository';

/**
 * Repository for CRUD operations on task layers.
 *
 * @export
 * @class TaskLayerRepository
 * @extends {BaseRepository}
 */
export class TaskLayerRepository extends BaseRepository {
  /**
   * Creates a new task layer.
   *
   * @param {CreateTaskLayer} taskLayer
   * @return {*}  {Promise<TaskLayer>}
   * @memberof TaskLayerRepository
   */
  async createTaskLayer(taskLayer: CreateTaskLayer): Promise<TaskLayer> {
    const sqlStatement = SQL`
      INSERT INTO task_layer (task_id, layer_name, description, mode, importance, threshold)
      VALUES (
        ${taskLayer.task_id},
        ${taskLayer.layer_name},
        ${taskLayer.description},
        ${taskLayer.mode},
        ${taskLayer.importance ?? null},
        ${taskLayer.threshold ?? null}
      )
      RETURNING task_layer_id, task_id, layer_name, description, mode, importance, threshold
    `;

    const response = await this.connection.sql(sqlStatement, TaskLayer);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create task layer', [
        'TaskLayerRepository->createTaskLayer',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches a task layer by its ID.
   *
   * @param {string} taskLayerId
   * @return {*}  {Promise<TaskLayer>}
   * @memberof TaskLayerRepository
   */
  async getTaskLayerById(taskLayerId: string): Promise<TaskLayer> {
    const sqlStatement = SQL`
      SELECT task_layer_id, task_id, layer_name, description, mode, importance, threshold
      FROM task_layer
      WHERE task_layer_id = ${taskLayerId}
    `;

    const response = await this.connection.sql(sqlStatement, TaskLayer);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to fetch task layer', [
        'TaskLayerRepository->getTaskLayerById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches all task layers for a given task ID.
   *
   * @param {string} taskId
   * @return {*}  {Promise<TaskLayer[]>}
   * @memberof TaskLayerRepository
   */
  async getTaskLayersByTaskId(taskId: string): Promise<TaskLayer[]> {
    const sqlStatement = SQL`
      SELECT task_layer_id, task_id, layer_name, description, mode, importance, threshold
      FROM task_layer
      WHERE task_id = ${taskId}
    `;

    const response = await this.connection.sql(sqlStatement, TaskLayer);

    return response.rows;
  }

  /**
   * Deletes a task layer.
   *
   * @param {DeleteTaskLayer} data
   * @return {*}  {Promise<void>}
   * @memberof TaskLayerRepository
   */
  async deleteTaskLayer(data: DeleteTaskLayer): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM task_layer
      WHERE task_layer_id = ${data.task_layer_id}
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete task layer', [
        'TaskLayerRepository->deleteTaskLayer',
        'Expected rowCount = 1'
      ]);
    }
  }
}
