import { IDBConnection } from '../database/db';
import { CreateTaskLayer, DeleteTaskLayer, TaskLayer } from '../models/task-layer';
import { TaskLayerRepository } from '../repositories/task-layer-repository';
import { DBService } from './db-service';

/**
 * Service for managing task layers.
 *
 * @export
 * @class TaskLayerService
 * @extends {DBService}
 */
export class TaskLayerService extends DBService {
  taskLayerRepository: TaskLayerRepository;

  /**
   * Creates an instance of TaskLayerService.
   *
   * @param {IDBConnection} connection
   * @memberof TaskLayerService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.taskLayerRepository = new TaskLayerRepository(connection);
  }

  /**
   * Create a new task layer.
   *
   * @param {CreateTaskLayer} taskLayer
   * @return {*}  {Promise<TaskLayer>}
   * @memberof TaskLayerService
   */
  async createTaskLayer(taskLayer: CreateTaskLayer): Promise<TaskLayer> {
    return this.taskLayerRepository.createTaskLayer(taskLayer);
  }

  /**
   * Get a task layer by ID.
   *
   * @param {string} taskLayerId
   * @return {*}  {Promise<TaskLayer>}
   * @memberof TaskLayerService
   */
  async getTaskLayerById(taskLayerId: string): Promise<TaskLayer> {
    return this.taskLayerRepository.getTaskLayerById(taskLayerId);
  }

  /**
   * Get all task layers for a given task ID.
   *
   * @param {string} taskId
   * @return {*}  {Promise<TaskLayer[]>}
   * @memberof TaskLayerService
   */
  async getTaskLayersByTaskId(taskId: string): Promise<TaskLayer[]> {
    return this.taskLayerRepository.getTaskLayersByTaskId(taskId);
  }

  /**
   * Delete a task layer.
   *
   * @param {DeleteTaskLayer} data
   * @return {*}  {Promise<void>}
   * @memberof TaskLayerService
   */
  async deleteTaskLayer(data: DeleteTaskLayer): Promise<void> {
    return this.taskLayerRepository.deleteTaskLayer(data);
  }
}
