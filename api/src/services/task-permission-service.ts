import { IDBConnection } from '../database/db';
import {
  CreateTaskPermission,
  DeleteTaskPermission,
  TaskPermission,
  UpdateTaskPermission
} from '../models/task-permission';
import { TaskPermissionRepository } from '../repositories/task-permission-repository';
import { DBService } from './db-service';

/**
 * Service for managing task permissions.
 *
 * @export
 * @class TaskPermissionService
 * @extends {DBService}
 */
export class TaskPermissionService extends DBService {
  taskPermissionRepository: TaskPermissionRepository;

  /**
   * Creates an instance of TaskPermissionService.
   *
   * @param {IDBConnection} connection Database connection used for queries and transaction context.
   * @memberof TaskPermissionService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.taskPermissionRepository = new TaskPermissionRepository(connection);
  }

  /**
   * Create a new task permission.
   *
   * @param {CreateTaskPermission} permission Permission fields to persist.
   * @returns {Promise<TaskPermission>} The task permission record.
   * @memberof TaskPermissionService
   */
  async createTaskPermission(permission: CreateTaskPermission): Promise<TaskPermission> {
    return this.taskPermissionRepository.createTaskPermission(permission);
  }

  /**
   * Get a task permission by ID.
   *
   * @param {string} taskPermissionId Identifier of the task permission.
   * @returns {Promise<TaskPermission>} The task permission record.
   * @memberof TaskPermissionService
   */
  async getTaskPermissionById(taskPermissionId: string): Promise<TaskPermission> {
    return this.taskPermissionRepository.getTaskPermissionById(taskPermissionId);
  }

  /**
   * Get all active task permissions.
   *
   * @returns {Promise<TaskPermission[]>} Matching task permission records.
   * @memberof TaskPermissionService
   */
  async getAllTaskPermissions(): Promise<TaskPermission[]> {
    return this.taskPermissionRepository.getAllTaskPermissions();
  }

  /**
   * Update an existing task permission.
   *
   * @param {string} taskPermissionId Identifier of the task permission.
   * @param {UpdateTaskPermission} updates Fields to update on the existing record.
   * @returns {Promise<TaskPermission>} The task permission record.
   * @memberof TaskPermissionService
   */
  async updateTaskPermission(taskPermissionId: string, updates: UpdateTaskPermission): Promise<TaskPermission> {
    return this.taskPermissionRepository.updateTaskPermission(taskPermissionId, updates);
  }

  /**
   * Soft delete a task permission.
   *
   * @param {DeleteTaskPermission} data Data to persist or process.
   * @returns {Promise<void>} Resolves when the operation completes.
   * @memberof TaskPermissionService
   */
  async deleteTaskPermission(data: DeleteTaskPermission): Promise<void> {
    return this.taskPermissionRepository.deleteTaskPermission(data);
  }
}
