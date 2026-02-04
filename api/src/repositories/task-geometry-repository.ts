import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateTaskGeometry, TaskGeometry, TaskGeometryWithGeometry } from '../models/task-geometry';
import { BaseRepository } from './base-repository';

/**
 * Repository for task geometry join records.
 *
 * @export
 * @class TaskGeometryRepository
 * @extends {BaseRepository}
 */
export class TaskGeometryRepository extends BaseRepository {
  /**
   * Creates a task geometry join record.
   *
   * @param {CreateTaskGeometry} taskGeometry
   * @return {*}  {Promise<TaskGeometry>}
   * @memberof TaskGeometryRepository
   */
  async createTaskGeometry(taskGeometry: CreateTaskGeometry): Promise<TaskGeometry> {
    const sqlStatement = SQL`
      INSERT INTO task_geometry (
        task_id,
        geometry_id
      ) VALUES (
        ${taskGeometry.task_id},
        ${taskGeometry.geometry_id}
      )
      RETURNING task_geometry_id, task_id, geometry_id
    `;

    const response = await this.connection.sql(sqlStatement, TaskGeometry);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create task geometry', [
        'TaskGeometryRepository->createTaskGeometry',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches geometries associated with a task.
   *
   * @param {string} taskId
   * @return {*}  {Promise<TaskGeometryWithGeometry[]>}
   * @memberof TaskGeometryRepository
   */
  async getGeometriesByTaskId(taskId: string): Promise<TaskGeometryWithGeometry[]> {
    const sqlStatement = SQL`
      SELECT
        tg.task_id,
        g.geometry_id,
        g.name,
        g.description,
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(g.geometry)::json,
          'properties', jsonb_build_object()
        ) AS geojson
      FROM task_geometry tg
      JOIN geometry g ON g.geometry_id = tg.geometry_id
      WHERE tg.task_id = ${taskId}
      AND tg.record_end_date IS NULL
      AND g.record_end_date IS NULL
      ORDER BY tg.created_at ASC
    `;

    const response = await this.connection.sql(sqlStatement, TaskGeometryWithGeometry);

    return response.rows;
  }

  /**
   * Fetches geometries for multiple tasks.
   *
   * @param {string[]} taskIds
   * @return {*}  {Promise<TaskGeometryWithGeometry[]>}
   * @memberof TaskGeometryRepository
   */
  async getGeometriesByTaskIds(taskIds: string[]): Promise<TaskGeometryWithGeometry[]> {
    const sqlStatement = SQL`
      SELECT
        tg.task_id,
        g.geometry_id,
        g.name,
        g.description,
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(g.geometry)::json,
          'properties', jsonb_build_object()
        ) AS geojson
      FROM task_geometry tg
      JOIN geometry g ON g.geometry_id = tg.geometry_id
      WHERE tg.task_id = ANY(${taskIds})
      AND tg.record_end_date IS NULL
      AND g.record_end_date IS NULL
      ORDER BY tg.created_at ASC
    `;

    const response = await this.connection.sql(sqlStatement, TaskGeometryWithGeometry);

    return response.rows;
  }
}
