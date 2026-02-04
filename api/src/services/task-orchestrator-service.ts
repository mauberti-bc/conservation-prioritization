import { IDBConnection } from '../database/db';
import { CreateTask } from '../models/task';
import { TaskWithLayers } from '../models/task.interface';
import { CreateTaskRequest } from '../models/task-orchestrator';
import { CreateTaskLayer } from '../models/task-layer';
import { CreateTaskLayerConstraint } from '../models/task-layer-constraint';
import { PrefectSubmissionError } from '../errors/prefect-error';
import { buildOptimizationParameters } from '../utils/task-optimization';
import { PrefectService } from './prefect-service';
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
  private prefectService: PrefectService;

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
    this.prefectService = new PrefectService();
  }

  /**
   * Creates a new task along with its layers and constraints.
   *
   * @param {CreateTaskRequest} request - The data for creating a task, including layers and constraints.
   * @return {*} {Promise<Task>} - The newly created task.
   * @memberof TaskOrchestratorService
   */
  async createTask(request: CreateTaskRequest): Promise<TaskWithLayers> {
    // Step 1: Create the task
    const taskData: CreateTask = {
      name: request.name,
      description: request.description,
      status: 'pending'
    };
    const task = await this.taskService.createTask(taskData);

    // Step 2: Create each configured layer for the task
    for (const layer of request.layers) {
      const layerData: CreateTaskLayer = {
        task_id: task.task_id,
        layer_name: layer.layer_name,
        description: layer.description ?? null,
        mode: layer.mode,
        importance: layer.importance ?? null,
        threshold: layer.threshold ?? null
      };
      const createdLayer = await this.taskLayerService.createTaskLayer(layerData);

      // Step 3: Create constraints for the layer
      for (const constraint of layer.constraints) {
        const constraintData: CreateTaskLayerConstraint = {
          task_layer_id: createdLayer.task_layer_id,
          type: constraint.type,
          min: constraint.min ?? null,
          max: constraint.max ?? null
        };
        await this.taskLayerConstraintService.createTaskLayerConstraint(constraintData);
      }
    }

    // Step 3: Optionally persist budget layer as a configured task layer
    if (request.budget) {
      const budgetLayerData: CreateTaskLayer = {
        task_id: task.task_id,
        layer_name: request.budget.layer_name,
        description: request.budget.description ?? null,
        mode: request.budget.mode,
        importance: request.budget.importance ?? null,
        threshold: request.budget.threshold ?? null
      };

      const createdBudgetLayer = await this.taskLayerService.createTaskLayer(budgetLayerData);

      for (const constraint of request.budget.constraints) {
        const constraintData: CreateTaskLayerConstraint = {
          task_layer_id: createdBudgetLayer.task_layer_id,
          type: constraint.type,
          min: constraint.min ?? null,
          max: constraint.max ?? null
        };
        await this.taskLayerConstraintService.createTaskLayerConstraint(constraintData);
      }
    }

    return this.taskService.getTaskById(task.task_id);
  }

  /**
   * Creates a new task with layers and submits execution to Prefect within the same transaction.
   *
   * @param {CreateTaskRequest} request - The data for creating a task, including layers and constraints.
   * @return {*} {Promise<TaskWithLayers>} - The newly created task with Prefect linkage.
   * @memberof TaskOrchestratorService
   */
  async createTaskAndSubmit(request: CreateTaskRequest): Promise<TaskWithLayers> {
    const task = await this.createTask(request);
    const optimizationParameters = buildOptimizationParameters(request);

    try {
      const { deploymentId, flowRunId } = await this.prefectService.submitStrictOptimization(
        task.task_id,
        optimizationParameters
      );

      await this.taskService.updateTaskExecution(task.task_id, {
        status: 'submitted',
        status_message: null,
        prefect_flow_run_id: flowRunId,
        prefect_deployment_id: deploymentId
      });
    } catch (error) {
      await this.taskService.updateTaskExecution(task.task_id, {
        status: 'failed_to_submit',
        status_message: error instanceof Error ? error.message : 'Failed to submit task to Prefect.'
      });

      throw new PrefectSubmissionError('Failed to submit task to Prefect.');
    }

    return this.taskService.getTaskById(task.task_id);
  }
}
