import { IDBConnection } from '../database/db';
import { CreateTask, Task } from '../models/task';
import { CreateTaskLayer, CreateTaskLayerConstraint, CreateTaskRequest } from '../models/task-orchestrator';
import { TaskLayerConstraintService } from './task-layer-constraint-service';
import { TaskLayerService } from './task-layer-service';
import { TaskService } from './task-service';

/**
 * Orchestrator for handling task creation workflows including layers and constraints.
 *
 * @export
 * @class TaskOrchestratorService
 */
export class TaskOrchestratorService {
  private taskService: TaskService;
  private taskLayerService: TaskLayerService;
  private taskLayerConstraintService: TaskLayerConstraintService;

  /**
   * Creates an instance of TaskOrchestratorService.
   *
   * @param {IDBConnection} connection - The database connection object.
   * @memberof TaskOrchestratorService
   */
  constructor(connection: IDBConnection) {
    this.taskService = new TaskService(connection);
    this.taskLayerService = new TaskLayerService(connection);
    this.taskLayerConstraintService = new TaskLayerConstraintService(connection);
  }

  /**
   * Creates a new task along with its layers and constraints.
   *
   * @param {CreateTaskRequest} request - The data for creating a task, including layers and constraints.
   * @return {*} {Promise<Task>} - The newly created task.
   * @memberof TaskOrchestratorService
   */
  async createTask(request: CreateTaskRequest): Promise<Task> {
    // Step 1: Create the task
    const taskData: CreateTask = {
      name: request.name,
      description: request.description
    };
    const task = await this.taskService.createTask(taskData);

    // Step 2: Create each layer for the task
    for (const layer of request.layers) {
      const layerData: CreateTaskLayer = {
        ...layer,
        task_id: task.task_id
      };
      const createdLayer = await this.taskLayerService.createTaskLayer(layerData);

      // Step 3: Create constraints for the layer
      for (const constraint of layer.constraints) {
        const constraintData: CreateTaskLayerConstraint = {
          ...constraint,
          task_layer_id: createdLayer.task_layer_id
        };
        await this.taskLayerConstraintService.createTaskLayerConstraint(constraintData);
      }
    }

    return task;
  }
}
