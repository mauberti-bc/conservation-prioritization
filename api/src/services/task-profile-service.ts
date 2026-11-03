import { IDBConnection } from '../database/db';
import {
  CreateTaskProfile,
  DeleteTaskProfile,
  TaskProfile,
  TaskProfileExtended,
  UpdateTaskProfile
} from '../models/task-profile';
import { TaskProfileRepository } from '../repositories/task-profile-repository';
import { DBService } from './db-service';

/**
 * Service for managing task profiles.
 *
 * @export
 * @class TaskProfileService
 * @extends {DBService}
 */
export class TaskProfileService extends DBService {
  taskProfileRepository: TaskProfileRepository;

  /**
   * Creates an instance of TaskProfileService.
   *
   * @param {IDBConnection} connection Database connection used for queries and transaction context.
   * @memberof TaskProfileService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.taskProfileRepository = new TaskProfileRepository(connection);
  }

  /**
   * Create a new task profile.
   *
   * @param {CreateTaskProfile} taskProfile Task-to-profile association to persist.
   * @returns {Promise<TaskProfile>} The task profile record.
   * @memberof TaskProfileService
   */
  async createTaskProfile(taskProfile: CreateTaskProfile): Promise<TaskProfile> {
    return this.taskProfileRepository.createTaskProfile(taskProfile);
  }

  /**
   * Get a task profile by ID.
   *
   * @param {string} taskProfileId Identifier of the task-to-profile association.
   * @returns {Promise<TaskProfile>} The task profile record.
   * @memberof TaskProfileService
   */
  async getTaskProfileById(taskProfileId: string): Promise<TaskProfile> {
    return this.taskProfileRepository.getTaskProfileById(taskProfileId);
  }

  /**
   * Get task profiles by task ID
   *
   * @param {string} taskId Identifier of the task.
   * @returns {Promise<TaskProfileExtended[]>} Matching task profile extended records.
   * @memberof TaskProfileService
   */
  async getTaskProfilesByTaskId(taskId: string): Promise<TaskProfileExtended[]> {
    return this.taskProfileRepository.getTaskProfilesByTaskId(taskId);
  }

  /**
   * Get all task profiles.
   *
   * @returns {Promise<TaskProfile[]>} Matching task profile records.
   * @memberof TaskProfileService
   */
  async getAllTaskProfiles(): Promise<TaskProfile[]> {
    return this.taskProfileRepository.getAllTaskProfiles();
  }

  /**
   * Update an existing task profile.
   *
   * @param {string} taskProfileId Identifier of the task-to-profile association.
   * @param {UpdateTaskProfile} updates Fields to update on the existing record.
   * @returns {Promise<TaskProfile>} The task profile record.
   * @memberof TaskProfileService
   */
  async updateTaskProfile(taskProfileId: string, updates: UpdateTaskProfile): Promise<TaskProfile> {
    return this.taskProfileRepository.updateTaskProfile(taskProfileId, updates);
  }

  /**
   * Soft delete a task profile.
   *
   * @param {DeleteTaskProfile} data Data to persist or process.
   * @returns {Promise<void>} Resolves when the operation completes.
   * @memberof TaskProfileService
   */
  async deleteTaskProfile(data: DeleteTaskProfile): Promise<void> {
    return this.taskProfileRepository.deleteTaskProfile(data);
  }

  /**
   * Get the role name for a specific profile on a task.
   *
   * @param {string} taskId - The ID of the task.
   * @param {string} profileId - The ID of the profile.
   * @return {Promise<string | null>} - Returns the role name if found, otherwise null.
   * @memberof TaskProfileRepository
   */
  async getRoleForTaskProfile(taskId: string, profileId: string): Promise<string | null> {
    return this.taskProfileRepository.getRoleForTaskProfile(taskId, profileId);
  }
}
