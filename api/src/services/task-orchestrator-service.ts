import { IDBConnection } from '../database/db';
import { PrefectSubmissionError } from '../errors/prefect-error';
import { CreateGeometry } from '../models/geometry';
import { CreateTask, TaskStatus } from '../models/task';
import { CreateTaskLayer } from '../models/task-layer';
import { CreateTaskLayerConstraint } from '../models/task-layer-constraint';
import { CreateTaskRequest } from '../models/task-orchestrator';
import { TaskWithLayers } from '../models/task.interface';
import { TASK_STATUS } from '../types/status';
import { buildOptimizationParameters } from '../utils/task-optimization';
import { GeometryService } from './geometry-service';
import { PrefectService } from './prefect-service';
import { TaskGeometryService } from './task-geometry-service';
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
  private geometryService: GeometryService;
  private taskGeometryService: TaskGeometryService;
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
    this.geometryService = new GeometryService(connection);
    this.taskGeometryService = new TaskGeometryService(connection);
    this.prefectService = new PrefectService();
  }

  /**
   * Creates a new task along with its layers and constraints.
   *
   * @param {CreateTaskRequest} request - The data for creating a task, including layers and constraints.
   * @return {*} {Promise<Task>} - The newly created task.
   * @memberof TaskOrchestratorService
   */
  async createTask(request: CreateTaskRequest, profileId?: string | null): Promise<TaskWithLayers> {
    // Step 1: Create the task
    const taskData: CreateTask = {
      name: request.name,
      description: request.description,
      status: TASK_STATUS.PENDING
    };
    const task = await this.taskService.createTask(taskData);
    if (profileId) {
      await this.taskService.addCreatorAsAdmin(task.task_id, profileId);
    }

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

    // Step 4: Persist geometries and task associations
    if (request.geometry && request.geometry.length > 0) {
      for (const [index, geometry] of request.geometry.entries()) {
        const geometryPayload: CreateGeometry = {
          name: geometry.name?.trim() || `Geometry ${index + 1}`,
          description: geometry.description ?? null,
          geojson: geometry.geojson
        };

        const createdGeometry = await this.geometryService.createGeometry(geometryPayload);
        await this.taskGeometryService.createTaskGeometry({
          task_id: task.task_id,
          geometry_id: createdGeometry.geometry_id
        });
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
  async createTaskAndSubmit(request: CreateTaskRequest, profileId?: string | null): Promise<TaskWithLayers> {
    const task = await this.createTask(request, profileId);
    const optimizationParameters = buildOptimizationParameters(request);

    try {
      const { deploymentId, flowRunId } = await this.prefectService.submitStrictOptimization(
        task.task_id,
        optimizationParameters
      );

      await this.taskService.updateTaskExecution(task.task_id, {
        status: TASK_STATUS.SUBMITTED,
        status_message: null,
        prefect_flow_run_id: flowRunId,
        prefect_deployment_id: deploymentId
      });
    } catch (error) {
      await this.taskService.updateTaskExecution(task.task_id, {
        status: TASK_STATUS.FAILED_TO_SUBMIT,
        status_message: error instanceof Error ? error.message : 'Failed to submit task to Prefect.'
      });

      throw new PrefectSubmissionError('Failed to submit task to Prefect.');
    }

    return this.taskService.getTaskById(task.task_id);
  }

  /**
   * Resubmits a failed task by re-using its saved configuration.
   *
   * @param {string} taskId
   * @return {*}  {Promise<TaskWithLayers>}
   * @memberof TaskOrchestratorService
   */
  async resubmitTask(taskId: string): Promise<TaskWithLayers> {
    const task = await this.taskService.getTaskById(taskId);

    const request: CreateTaskRequest = {
      name: task.name,
      description: task.description ?? '',
      layers: task.layers.map((layer) => ({
        layer_name: layer.layer_name,
        description: layer.description ?? null,
        mode: layer.mode,
        importance: layer.importance ?? null,
        threshold: layer.threshold ?? null,
        constraints: layer.constraints.map((constraint) => ({
          type: constraint.type,
          min: constraint.min ?? null,
          max: constraint.max ?? null
        }))
      })),
      resolution: task.resolution ?? undefined,
      resampling: task.resampling ?? undefined,
      variant: task.variant ?? undefined,
      geometry: task.geometries?.map((geometry) => ({
        name: geometry.name ?? null,
        description: geometry.description ?? null,
        geojson: geometry.geojson
      })),
      budget: task.budget
        ? {
            layer_name: task.budget.layer_name,
            description: task.budget.description ?? null,
            mode: task.budget.mode,
            importance: task.budget.importance ?? null,
            threshold: task.budget.threshold ?? null,
            constraints: task.budget.constraints.map((constraint) => ({
              type: constraint.type,
              min: constraint.min ?? null,
              max: constraint.max ?? null
            }))
          }
        : undefined
    };

    const optimizationParameters = buildOptimizationParameters(request);

    try {
      const { deploymentId, flowRunId } = await this.prefectService.submitStrictOptimization(
        task.task_id,
        optimizationParameters
      );

      await this.taskService.updateTaskExecution(task.task_id, {
        status: TASK_STATUS.SUBMITTED,
        status_message: null,
        prefect_flow_run_id: flowRunId,
        prefect_deployment_id: deploymentId
      });
    } catch (error) {
      await this.taskService.updateTaskExecution(task.task_id, {
        status: TASK_STATUS.FAILED_TO_SUBMIT,
        status_message: error instanceof Error ? error.message : 'Failed to submit task to Prefect.'
      });

      throw new PrefectSubmissionError('Failed to submit task to Prefect.');
    }

    return this.taskService.getTaskById(task.task_id);
  }

  /**
   * Retry a task by either resetting it to draft or resubmitting to Prefect.
   *
   * @param {string} taskId
   * @param {TaskStatus} status
   * @return {*}  {Promise<TaskWithLayers>}
   * @memberof TaskOrchestratorService
   */
  async retryTask(taskId: string, status: TaskStatus): Promise<TaskWithLayers> {
    if (status !== 'pending' && status !== 'draft') {
      throw new Error('Status must be pending or draft to retry task.');
    }

    if (status === 'draft') {
      await this.taskService.resetExecutionState(taskId, 'draft');
      return this.taskService.getTaskById(taskId);
    }

    return this.resubmitTask(taskId);
  }
}
