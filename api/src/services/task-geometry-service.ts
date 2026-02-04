import { IDBConnection } from '../database/db';
import { CreateTaskGeometry } from '../models/task-geometry';
import { Geometry } from '../models/geometry';
import { TaskGeometryRepository } from '../repositories/task-geometry-repository';
import { DBService } from './db-service';

/**
 * Service for managing task geometry associations.
 *
 * @export
 * @class TaskGeometryService
 * @extends {DBService}
 */
export class TaskGeometryService extends DBService {
  private taskGeometryRepository: TaskGeometryRepository;

  /**
   * Creates an instance of TaskGeometryService.
   *
   * @param {IDBConnection} connection - The database connection object.
   * @memberof TaskGeometryService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.taskGeometryRepository = new TaskGeometryRepository(connection);
  }

  /**
   * Creates a task geometry join record.
   *
   * @param {CreateTaskGeometry} taskGeometry
   * @return {*}  {Promise<void>}
   * @memberof TaskGeometryService
   */
  async createTaskGeometry(taskGeometry: CreateTaskGeometry): Promise<void> {
    await this.taskGeometryRepository.createTaskGeometry(taskGeometry);
  }

  /**
   * Fetches geometries associated with a task.
   *
   * @param {string} taskId
   * @return {*}  {Promise<Geometry[]>}
   * @memberof TaskGeometryService
   */
  async getGeometriesByTaskId(taskId: string): Promise<Geometry[]> {
    const rows = await this.taskGeometryRepository.getGeometriesByTaskId(taskId);
    return rows.map((row) => ({
      geometry_id: row.geometry_id,
      name: row.name,
      description: row.description,
      geojson: row.geojson
    }));
  }

  /**
   * Fetches geometries for multiple tasks.
   *
   * @param {string[]} taskIds
   * @return {*}  {Promise<Map<string, Geometry[]>>}
   * @memberof TaskGeometryService
   */
  async getGeometriesByTaskIds(taskIds: string[]): Promise<Map<string, Geometry[]>> {
    const rows = await this.taskGeometryRepository.getGeometriesByTaskIds(taskIds);
    const geometriesByTaskId = new Map<string, Geometry[]>();

    for (const row of rows) {
      const existing = geometriesByTaskId.get(row.task_id) ?? [];
      existing.push({
        geometry_id: row.geometry_id,
        name: row.name,
        description: row.description,
        geojson: row.geojson
      });
      geometriesByTaskId.set(row.task_id, existing);
    }

    return geometriesByTaskId;
  }
}
