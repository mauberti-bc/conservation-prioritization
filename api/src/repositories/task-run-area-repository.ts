import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateTaskRunArea, TaskRunArea } from '../models/task-run-area';
import { BaseRepository } from './base-repository';

const TASK_RUN_AREA_COLUMNS = `
  task_run_area_id, task_run_id, area_index, name, description, geojson
`;

/** Repository for immutable run target-area features. */
export class TaskRunAreaRepository extends BaseRepository {
  /**
   * Creates one persisted target-area feature for a task run.
   *
   * @param {string} taskRunId Parent task run ID that owns the immutable target-area feature.
   * @param {CreateTaskRunArea} area Ordered target-area metadata and GeoJSON feature to persist.
   * @returns {Promise<TaskRunArea>} Created target-area row.
   * @throws {ApiExecuteSQLError} When the insert does not create exactly one row.
   */
  async createTaskRunArea(taskRunId: string, area: CreateTaskRunArea): Promise<TaskRunArea> {
    const response = await this.connection.sql(
      SQL`
        INSERT INTO task_run_area (
          task_run_id, area_index, name, description, geojson
        ) VALUES (
          ${taskRunId},
          ${area.area_index},
          ${area.name},
          ${area.description ?? null},
          ${JSON.stringify(area.geojson)}::jsonb
        )
        RETURNING `.append(TASK_RUN_AREA_COLUMNS),
      TaskRunArea
    );

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create task run area', ['TaskRunAreaRepository->createTaskRunArea']);
    }

    return response.rows[0];
  }

  /**
   * Lists target-area features for one task run.
   *
   * @param {string} taskRunId Parent task run ID whose target-area features should be returned.
   * @returns {Promise<TaskRunArea[]>} Target-area features ordered by their persisted area index.
   * @throws {ApiExecuteSQLError} When the query cannot be executed.
   */
  async getTaskRunAreas(taskRunId: string): Promise<TaskRunArea[]> {
    const response = await this.connection.sql(
      SQL`SELECT `.append(TASK_RUN_AREA_COLUMNS).append(SQL`
        FROM task_run_area
        WHERE task_run_id = ${taskRunId}
        ORDER BY area_index
      `),
      TaskRunArea
    );

    return response.rows;
  }

  /**
   * Lists target-area features for provided task runs.
   *
   * @param {string[]} taskRunIds Parent task run IDs whose target-area features should be returned.
   * @returns {Promise<TaskRunArea[]>} Target-area features ordered by run ID and area index.
   * @throws {ApiExecuteSQLError} When the query cannot be executed.
   */
  async getTaskRunAreasByRunIds(taskRunIds: string[]): Promise<TaskRunArea[]> {
    if (!taskRunIds.length) {
      return [];
    }

    const response = await this.connection.sql(
      SQL`SELECT `.append(TASK_RUN_AREA_COLUMNS).append(SQL`
        FROM task_run_area
        WHERE task_run_id = ANY(${taskRunIds}::uuid[])
        ORDER BY task_run_id, area_index
      `),
      TaskRunArea
    );

    return response.rows;
  }
}
