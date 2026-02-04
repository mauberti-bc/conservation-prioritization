import { IDBConnection } from '../database/db';
import {
  CreateTaskLayerConstraint,
  DeleteTaskLayerConstraint,
  TaskLayerConstraint
} from '../models/task-layer-constraint';
import { TaskLayerConstraintRepository } from '../repositories/task-layer-constraint-repository';
import { DBService } from './db-service';

/**
 * Service for managing task layer constraints.
 *
 * @export
 * @class TaskLayerConstraintService
 * @extends {DBService}
 */
export class TaskLayerConstraintService extends DBService {
  taskLayerConstraintRepository: TaskLayerConstraintRepository;

  /**
   * Creates an instance of TaskLayerConstraintService.
   *
   * @param {IDBConnection} connection
   * @memberof TaskLayerConstraintService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.taskLayerConstraintRepository = new TaskLayerConstraintRepository(connection);
  }

  /**
   * Create a new task layer constraint.
   *
   * @param {CreateTaskLayerConstraint} taskLayerConstraint
   * @return {*}  {Promise<TaskLayerConstraint>}
   * @memberof TaskLayerConstraintService
   */
  async createTaskLayerConstraint(taskLayerConstraint: CreateTaskLayerConstraint): Promise<TaskLayerConstraint> {
    return this.taskLayerConstraintRepository.createTaskLayerConstraint(taskLayerConstraint);
  }

  /**
   * Get a task layer constraint by ID.
   *
   * @param {string} taskLayerConstraintId
   * @return {*}  {Promise<TaskLayerConstraint>}
   * @memberof TaskLayerConstraintService
   */
  async getTaskLayerConstraintById(taskLayerConstraintId: string): Promise<TaskLayerConstraint> {
    return this.taskLayerConstraintRepository.getTaskLayerConstraintById(taskLayerConstraintId);
  }

  /**
   * Get all task layer constraints for a given task layer ID.
   *
   * @param {string} taskLayerId
   * @return {*}  {Promise<TaskLayerConstraint[]>}
   * @memberof TaskLayerConstraintService
   */
  async getTaskLayerConstraintsByTaskLayerId(taskLayerId: string): Promise<TaskLayerConstraint[]> {
    return this.taskLayerConstraintRepository.getTaskLayerConstraintsByTaskLayerId(taskLayerId);
  }

  /**
   * Delete a task layer constraint.
   *
   * @param {DeleteTaskLayerConstraint} data
   * @return {*}  {Promise<void>}
   * @memberof TaskLayerConstraintService
   */
  async deleteTaskLayerConstraint(data: DeleteTaskLayerConstraint): Promise<void> {
    return this.taskLayerConstraintRepository.deleteTaskLayerConstraint(data);
  }
}
