import { IDBConnection } from '../database/db';
import { CreateTask, DeleteTask, Task, UpdateTask } from '../models/task';
import { TaskWithLayers, TaskLayerWithConstraints } from '../models/task.interface';
import { TaskRepository } from '../repositories/task-repository';
import { TaskLayerService } from './task-layer-service';
import { TaskLayerConstraintService } from './task-layer-constraint-service';
import { DBService } from './db-service';

/**
 * Service for managing task data.
 *
 * @export
 * @class TaskService
 * @extends {DBService}
 */
export class TaskService extends DBService {
  taskRepository: TaskRepository;
  taskLayerService: TaskLayerService;
  taskLayerConstraintService: TaskLayerConstraintService;

  /**
   * Creates an instance of TaskService.
   *
   * @param {IDBConnection} connection - The database connection object.
   * @memberof TaskService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.taskRepository = new TaskRepository(connection);
    this.taskLayerService = new TaskLayerService(connection);
    this.taskLayerConstraintService = new TaskLayerConstraintService(connection);
  }

  /**
   * Creates a new task.
   *
   * @param {CreateTask} task - The data for the new task (excluding `task_id`).
   * @return {*} {Promise<Task>} The newly created task.
   * @memberof TaskService
   */
  async createTask(task: CreateTask): Promise<Task> {
    return this.taskRepository.createTask(task);
  }

  /**
   * Gets a task by its ID.
   *
   * @param {string} taskId - The UUID of the task.
   * @return {*} {Promise<Task>} The task with the provided ID.
   * @memberof TaskService
   */
  async getTaskById(taskId: string): Promise<TaskWithLayers> {
    const task = await this.taskRepository.getTaskById(taskId);
    const layers = await this.getTaskLayersWithConstraints(taskId);

    return {
      ...task,
      layers
    };
  }

  /**
   * Gets all active tasks (where `record_end_date` is `NULL`).
   *
   * @return {*} {Promise<Task[]>} A list of all active tasks.
   * @memberof TaskService
   */
  async getAllTasks(): Promise<TaskWithLayers[]> {
    const tasks = await this.taskRepository.getAllTasks();

    const tasksWithLayers = await Promise.all(
      tasks.map(async (task) => {
        const layers = await this.getTaskLayersWithConstraints(task.task_id);
        return {
          ...task,
          layers
        };
      })
    );

    return tasksWithLayers;
  }

  /**
   * Updates an existing task.
   *
   * @param {string} taskId - The UUID of the task to update.
   * @param {UpdateTask} updates - The fields to update in the task record.
   * @return {*} {Promise<Task>} The updated task.
   * @memberof TaskService
   */
  async updateTask(taskId: string, updates: UpdateTask): Promise<Task> {
    return this.taskRepository.updateTask(taskId, updates);
  }

  /**
   * Soft deletes a task.
   *
   * @param {DeleteTask} data - The data for the task to delete.
   * @return {*} {Promise<void>} Resolves when the task is successfully deleted.
   * @memberof TaskService
   */
  async deleteTask(data: DeleteTask): Promise<void> {
    return this.taskRepository.deleteTask(data);
  }

  /**
   * Fetches configured task layers and their constraints.
   *
   * @param {string} taskId
   * @return {*} {Promise<TaskLayerWithConstraints[]>}
   * @memberof TaskService
   */
  private async getTaskLayersWithConstraints(taskId: string): Promise<TaskLayerWithConstraints[]> {
    const layers = await this.taskLayerService.getTaskLayersByTaskId(taskId);

    const layersWithConstraints = await Promise.all(
      layers.map(async (layer) => {
        const constraints = await this.taskLayerConstraintService.getTaskLayerConstraintsByTaskLayerId(
          layer.task_layer_id
        );

        return {
          ...layer,
          constraints
        };
      })
    );

    return layersWithConstraints;
  }
}
