import { IDBConnection } from '../database/db';
import { CreateTask, DeleteTask, Task, UpdateTask, UpdateTaskExecution } from '../models/task';
import { TaskLayerConstraint } from '../models/task-layer-constraint';
import { TaskLayerWithConstraints, TaskWithLayers } from '../models/task.interface';
import { TaskRepository } from '../repositories/task-repository';
import { TaskTileRepository } from '../repositories/task-tile-repository';
import { TASK_STATUS, TILE_STATUS } from '../types/status';
import { TaskStatusMessage } from '../types/task-status';
import { toPmtilesUrl } from '../utils/pmtiles';
import { normalizeTaskStatus, normalizeTileStatus } from '../utils/status';
import { DBService } from './db-service';
import { TaskLayerConstraintService } from './task-layer-constraint-service';
import { TaskLayerService } from './task-layer-service';

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
  taskTileRepository: TaskTileRepository;

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
    this.taskTileRepository = new TaskTileRepository(connection);
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
   * Gets all tasks available to the profile ID.
   *
   * @param {string} profileId
   * @return {*}  {Promise<TaskWithLayers[]>}
   * @memberof TaskService
   */
  async getTasksForProfile(profileId: string): Promise<TaskWithLayers[]> {
    const tasks = await this.taskRepository.getTasksByProfileId(profileId);
    const taskIds = tasks.map((task) => task.task_id);

    if (!taskIds.length) {
      return [];
    }

    const layersWithConstraints = await this.getTaskLayersWithConstraintsForTasks(taskIds);

    const layersByTaskId = new Map<string, TaskLayerWithConstraints[]>();
    for (const layer of layersWithConstraints) {
      const existing = layersByTaskId.get(layer.task_id) ?? [];
      existing.push(layer);
      layersByTaskId.set(layer.task_id, existing);
    }

    return tasks.map((task) => ({
      ...task,
      layers: layersByTaskId.get(task.task_id) ?? []
    }));
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
   * Updates task execution metadata including status and Prefect IDs.
   *
   * @param {string} taskId - The UUID of the task to update.
   * @param {UpdateTaskExecution} updates - Execution metadata updates.
   * @return {*} {Promise<Task>} The updated task.
   * @memberof TaskService
   */
  async updateTaskExecution(taskId: string, updates: UpdateTaskExecution): Promise<Task> {
    return this.taskRepository.updateTaskExecution(taskId, updates);
  }

  /**
   * Updates task status from internal workflows and returns the hydrated task.
   *
   * @param {string} taskId
   * @param {UpdateTaskExecution} updates
   * @return {*}  {Promise<TaskWithLayers>}
   * @memberof TaskService
   */
  async updateTaskStatus(taskId: string, updates: UpdateTaskExecution): Promise<TaskWithLayers> {
    await this.taskRepository.updateTaskExecution(taskId, updates);
    return this.getTaskById(taskId);
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
   * Fetches a snapshot of task status and tile state for websocket updates.
   *
   * @param {string} taskId
   * @return {*}  {Promise<TaskStatusMessage>}
   * @memberof TaskService
   */
  async getTaskStatusSnapshot(taskId: string): Promise<TaskStatusMessage> {
    const task = await this.taskRepository.findTaskById(taskId);

    if (!task) {
      return {
        task_id: taskId,
        status: TASK_STATUS.PENDING,
        tile: null
      };
    }

    const tile = await this.taskTileRepository.getLatestTaskTileByTaskId(taskId);
    const tileUri = toPmtilesUrl(tile?.uri ?? null);

    const normalizedStatus = normalizeTaskStatus(task.status);
    const normalizedTileStatus = normalizeTileStatus(tile?.status ?? null);

    if (!normalizedStatus) {
      throw new Error('Unrecognized task status value.');
    }

    return {
      task_id: task.task_id,
      status: normalizedStatus,
      tile: tile
        ? {
            status: normalizedTileStatus ?? TILE_STATUS.FAILED,
            uri: tileUri
          }
        : null
    };
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

  /**
   * Fetches configured task layers and their constraints for multiple tasks.
   *
   * @param {string[]} taskIds
   * @return {*} {Promise<TaskLayerWithConstraints[]>}
   * @memberof TaskService
   */
  private async getTaskLayersWithConstraintsForTasks(taskIds: string[]): Promise<TaskLayerWithConstraints[]> {
    const layers = await this.taskLayerService.taskLayerRepository.getTaskLayersByTaskIds(taskIds);
    const layerIds = layers.map((layer) => layer.task_layer_id);

    if (!layerIds.length) {
      return [];
    }

    const constraints =
      await this.taskLayerConstraintService.taskLayerConstraintRepository.getTaskLayerConstraintsByTaskLayerIds(
        layerIds
      );

    const constraintsByLayerId = new Map<string, TaskLayerConstraint[]>();
    for (const constraint of constraints) {
      const existing = constraintsByLayerId.get(constraint.task_layer_id) ?? [];
      existing.push(constraint);
      constraintsByLayerId.set(constraint.task_layer_id, existing);
    }

    return layers.map((layer) => ({
      ...layer,
      constraints: constraintsByLayerId.get(layer.task_layer_id) ?? []
    }));
  }
}
