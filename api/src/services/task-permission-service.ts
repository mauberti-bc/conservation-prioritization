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
   * @param {IDBConnection} connection
   * @memberof TaskPermissionService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.taskPermissionRepository = new TaskPermissionRepository(connection);
  }

  /**
   * Create a new task permission.
   *
   * @param {CreateTaskPermission} permission
   * @return {*}  {Promise<TaskPermission>}
   * @memberof TaskPermissionService
   */
  async createTaskPermission(permission: CreateTaskPermission): Promise<TaskPermission> {
    return this.taskPermissionRepository.createTaskPermission(permission);
  }

  /**
   * Get a task permission by ID.
   *
   * @param {string} taskPermissionId
   * @return {*}  {Promise<TaskPermission>}
   * @memberof TaskPermissionService
   */
  async getTaskPermissionById(taskPermissionId: string): Promise<TaskPermission> {
    return this.taskPermissionRepository.getTaskPermissionById(taskPermissionId);
  }

  /**
   * Get all active task permissions.
   *
   * @return {*}  {Promise<TaskPermission[]>}
   * @memberof TaskPermissionService
   */
  async getAllTaskPermissions(): Promise<TaskPermission[]> {
    return this.taskPermissionRepository.getAllTaskPermissions();
  }

  /**
   * Update an existing task permission.
   *
   * @param {string} taskPermissionId
   * @param {UpdateTaskPermission} updates
   * @return {*}  {Promise<TaskPermission>}
   * @memberof TaskPermissionService
   */
  async updateTaskPermission(taskPermissionId: string, updates: UpdateTaskPermission): Promise<TaskPermission> {
    return this.taskPermissionRepository.updateTaskPermission(taskPermissionId, updates);
  }

  /**
   * Soft delete a task permission.
   *
   * @param {DeleteTaskPermission} data
   * @return {*}  {Promise<void>}
   * @memberof TaskPermissionService
   */
  async deleteTaskPermission(data: DeleteTaskPermission): Promise<void> {
    return this.taskPermissionRepository.deleteTaskPermission(data);
  }
}
