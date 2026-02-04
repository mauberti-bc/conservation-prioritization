import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  CreateTaskLayerConstraint,
  DeleteTaskLayerConstraint,
  TaskLayerConstraint
} from '../models/task-layer-constraint';
import { BaseRepository } from './base-repository';

/**
 * Repository for CRUD operations on task layer constraints.
 *
 * @export
 * @class TaskLayerConstraintRepository
 * @extends {BaseRepository}
 */
export class TaskLayerConstraintRepository extends BaseRepository {
  /**
   * Creates a new task layer constraint.
   *
   * @param {CreateTaskLayerConstraint} taskLayerConstraint
   * @return {*}  {Promise<TaskLayerConstraint>}
   * @memberof TaskLayerConstraintRepository
   */
  async createTaskLayerConstraint(taskLayerConstraint: CreateTaskLayerConstraint): Promise<TaskLayerConstraint> {
    const sqlStatement = SQL`
      INSERT INTO task_layer_constraint (task_layer_id, type, min, max)
      VALUES (
        ${taskLayerConstraint.task_layer_id},
        ${taskLayerConstraint.type},
        ${taskLayerConstraint.min ?? null},
        ${taskLayerConstraint.max ?? null}
      )
      RETURNING task_layer_constraint_id, task_layer_id, type, min, max
    `;

    const response = await this.connection.sql(sqlStatement, TaskLayerConstraint);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create task layer constraint', [
        'TaskLayerConstraintRepository->createTaskLayerConstraint',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches a task layer constraint by its ID.
   *
   * @param {string} taskLayerConstraintId
   * @return {*}  {Promise<TaskLayerConstraint>}
   * @memberof TaskLayerConstraintRepository
   */
  async getTaskLayerConstraintById(taskLayerConstraintId: string): Promise<TaskLayerConstraint> {
    const sqlStatement = SQL`
      SELECT task_layer_constraint_id, task_layer_id, type, min, max
      FROM task_layer_constraint
      WHERE task_layer_constraint_id = ${taskLayerConstraintId}
    `;

    const response = await this.connection.sql(sqlStatement, TaskLayerConstraint);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to fetch task layer constraint', [
        'TaskLayerConstraintRepository->getTaskLayerConstraintById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches all task layer constraints for a given task layer ID.
   *
   * @param {string} taskLayerId
   * @return {*}  {Promise<TaskLayerConstraint[]>}
   * @memberof TaskLayerConstraintRepository
   */
  async getTaskLayerConstraintsByTaskLayerId(taskLayerId: string): Promise<TaskLayerConstraint[]> {
    const sqlStatement = SQL`
      SELECT task_layer_constraint_id, task_layer_id, type, min, max
      FROM task_layer_constraint
      WHERE task_layer_id = ${taskLayerId}
    `;

    const response = await this.connection.sql(sqlStatement, TaskLayerConstraint);

    return response.rows;
  }

  /**
   * Deletes a task layer constraint.
   *
   * @param {DeleteTaskLayerConstraint} data
   * @return {*}  {Promise<void>}
   * @memberof TaskLayerConstraintRepository
   */
  async deleteTaskLayerConstraint(data: DeleteTaskLayerConstraint): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM task_layer_constraint
      WHERE task_layer_constraint_id = ${data.task_layer_constraint_id}
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete task layer constraint', [
        'TaskLayerConstraintRepository->deleteTaskLayerConstraint',
        'Expected rowCount = 1'
      ]);
    }
  }
}
