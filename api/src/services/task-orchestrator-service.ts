import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { PrefectSubmissionError } from '../errors/prefect-error';
import { CreateGeometry } from '../models/geometry';
import { CreateTask, TaskStatus, UpdateTask } from '../models/task';
import { CreateTaskLayer } from '../models/task-layer';
import { CreateTaskLayerConstraint } from '../models/task-layer-constraint';
import { CreateTaskDraftRequest, CreateTaskRequest, SubmitTaskRequest } from '../models/task-orchestrator';
import { TaskWithLayers } from '../models/task.interface';
import { TASK_STATUS } from '../types/status';
import { buildOptimizationParameters } from '../utils/task-optimization';
import { DBService } from './db-service';
import { GeometryService } from './geometry-service';
import { LayerService } from './layer-service';
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
export class TaskOrchestratorService extends DBService {
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
    super(connection);
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
      resolution: request.resolution ?? null,
      resampling: request.resampling ?? null,
      variant: request.variant ?? null,
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
   * Creates a draft task without submitting it to Prefect.
   *
   * @param {CreateTaskDraftRequest} request
   * @param {(string | null)} [profileId]
   * @return {*}  {Promise<TaskWithLayers>}
   * @memberof TaskOrchestratorService
   */
  async createDraftTask(request: CreateTaskDraftRequest, profileId?: string | null): Promise<TaskWithLayers> {
    const taskData: CreateTask = {
      name: request.name,
      description: request.description ?? null,
      resolution: null,
      resampling: null,
      variant: null,
      status: TASK_STATUS.DRAFT
    };

    const task = await this.taskService.createTask(taskData);

    if (profileId) {
      await this.taskService.addCreatorAsAdmin(task.task_id, profileId);
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
      // Immediately return the task if there are no layers, do not submit to prefect
      if (!request.layers.length && !request.budget) {
        return this.taskService.getTaskById(task.task_id);
      }

      await this.validateLayerPaths(request);
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
      console.log(error);
      await this.taskService.updateTaskExecution(task.task_id, {
        status: TASK_STATUS.FAILED_TO_SUBMIT,
        status_message: error instanceof Error ? error.message : 'Failed to submit task to Prefect.'
      });

      // Commit because this is a transaction, so throwing will roll back the above update to failure
      await this.connection.commit();

      throw new PrefectSubmissionError('Failed to submit task to Prefect.');
    }

    return this.taskService.getTaskById(task.task_id);
  }

  /**
   * Submits an existing draft task to Prefect using provided layer configuration.
   *
   * @param {string} taskId
   * @param {SubmitTaskRequest} request
   * @return {*}  {Promise<TaskWithLayers>}
   * @memberof TaskOrchestratorService
   */
  async submitExistingTask(taskId: string, request: SubmitTaskRequest): Promise<TaskWithLayers> {
    const task = await this.taskService.getTaskById(taskId);

    if (task.status !== TASK_STATUS.DRAFT) {
      throw new ApiGeneralError('Only draft tasks can be submitted.');
    }

    const mergedLayers = request.layers ?? task.layers.map((layer) => ({
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
    }));

    if (!mergedLayers.length) {
      throw new ApiGeneralError('Task must include at least one non-budget layer path to submit.');
    }

    const existingBudget = task.layers.find((layer) => {
      return layer.layer_name === 'financial/cost';
    });

    const mergedBudget =
      request.budget !== undefined
        ? request.budget
        : existingBudget
          ? {
              layer_name: existingBudget.layer_name,
              description: existingBudget.description ?? null,
              mode: existingBudget.mode,
              importance: existingBudget.importance ?? null,
              threshold: existingBudget.threshold ?? null,
              constraints: existingBudget.constraints.map((constraint) => ({
                type: constraint.type,
                min: constraint.min ?? null,
                max: constraint.max ?? null
              }))
            }
          : undefined;

    if (request.layers !== undefined || request.budget !== undefined) {
      await this.replaceTaskLayers(taskId, {
        layers: mergedLayers,
        budget: mergedBudget ?? undefined
      });
    }

    if (request.geometry !== undefined) {
      await this.replaceTaskGeometry(taskId, request.geometry);
    }

    const taskUpdates: UpdateTask = {};
    if (request.resolution !== undefined) {
      taskUpdates.resolution = request.resolution ?? null;
    }
    if (request.resampling !== undefined) {
      taskUpdates.resampling = request.resampling ?? null;
    }
    if (request.variant !== undefined) {
      taskUpdates.variant = request.variant ?? null;
    }

    if (Object.keys(taskUpdates).length > 0) {
      await this.taskService.updateTask(taskId, taskUpdates);
    }

    const refreshedTask = await this.taskService.getTaskById(taskId);
    const refreshedLayers = refreshedTask.layers.filter((layer) => {
      return layer.layer_name !== 'financial/cost';
    });

    if (!refreshedLayers.length) {
      throw new ApiGeneralError('Task must include at least one non-budget layer path to submit.');
    }

    const refreshedBudgetLayer = refreshedTask.layers.find((layer) => {
      return layer.layer_name === 'financial/cost';
    });

    const submitRequest: CreateTaskRequest = {
      name: refreshedTask.name,
      description: refreshedTask.description ?? '',
      resolution: refreshedTask.resolution ?? undefined,
      resampling: refreshedTask.resampling ?? undefined,
      variant: refreshedTask.variant ?? undefined,
      layers: refreshedLayers.map((layer) => ({
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
      budget: refreshedBudgetLayer
        ? {
            layer_name: refreshedBudgetLayer.layer_name,
            description: refreshedBudgetLayer.description ?? null,
            mode: refreshedBudgetLayer.mode,
            importance: refreshedBudgetLayer.importance ?? null,
            threshold: refreshedBudgetLayer.threshold ?? null,
            constraints: refreshedBudgetLayer.constraints.map((constraint) => ({
              type: constraint.type,
              min: constraint.min ?? null,
              max: constraint.max ?? null
            }))
          }
        : undefined,
      target_area: request.target_area ?? 50,
      is_percentage: request.is_percentage ?? true,
      geometry: refreshedTask.geometries?.map((geometry) => ({
        name: geometry.name ?? null,
        description: geometry.description ?? null,
        geojson: this.normalizeGeoJsonPayload(geometry.geojson)
      }))
    };

    const optimizationParameters = buildOptimizationParameters(submitRequest);

    try {
      await this.taskService.updateTaskExecution(taskId, {
        status: TASK_STATUS.PENDING,
        status_message: null,
        prefect_flow_run_id: null,
        prefect_deployment_id: null
      });

      await this.validateLayerPaths(submitRequest);

      const { deploymentId, flowRunId } = await this.prefectService.submitStrictOptimization(
        taskId,
        optimizationParameters
      );

      await this.taskService.updateTaskExecution(taskId, {
        status: TASK_STATUS.SUBMITTED,
        status_message: null,
        prefect_flow_run_id: flowRunId,
        prefect_deployment_id: deploymentId
      });
    } catch (error) {
      await this.taskService.updateTaskExecution(taskId, {
        status: TASK_STATUS.FAILED_TO_SUBMIT,
        status_message: error instanceof Error ? error.message : 'Failed to submit task to Prefect.'
      });

      // Commit because this is a transaction, so throwing will roll back the above update to failure
      await this.connection.commit();

      throw new PrefectSubmissionError('Failed to submit task to Prefect.');
    }

    return this.taskService.getTaskById(taskId);
  }

  /**
   * Replaces the task layer configuration without submitting to Prefect.
   *
   * @param {string} taskId
   * @param {SubmitTaskRequest} request
   * @return {*}  {Promise<TaskWithLayers>}
   * @memberof TaskOrchestratorService
   */
  async configureTaskLayers(taskId: string, request: SubmitTaskRequest): Promise<TaskWithLayers> {
    await this.replaceTaskLayers(taskId, {
      layers: request.layers ?? [],
      budget: request.budget ?? undefined
    });
    return this.taskService.getTaskById(taskId);
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
        geojson: this.normalizeGeoJsonPayload(geometry.geojson)
      }))
    };

    if (!request.layers.length && !request.budget) {
      await this.taskService.updateTaskExecution(task.task_id, {
        status: TASK_STATUS.PENDING,
        status_message: null,
        prefect_flow_run_id: null,
        prefect_deployment_id: null
      });
      return this.taskService.getTaskById(task.task_id);
    }

    const optimizationParameters = buildOptimizationParameters(request);

    try {
      await this.validateLayerPaths(request);
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

      // Commit because this is a transaction, so throwing will roll back the above update to failure
      await this.connection.commit();

      throw new PrefectSubmissionError('Failed to submit task to Prefect.');
    }

    return this.taskService.getTaskById(task.task_id);
  }

  /**
   * Normalize geometry payloads to the shape expected by CreateTaskGeometryRequest.
   *
   * @param {unknown} geojson
   * @return {*}  {{ geometry: unknown; [key: string]: unknown }}
   * @memberof TaskOrchestratorService
   */
  private normalizeGeoJsonPayload(geojson: unknown): { geometry: unknown; [key: string]: unknown } {
    if (geojson && typeof geojson === 'object' && 'geometry' in geojson) {
      return geojson as { geometry: unknown; [key: string]: unknown };
    }

    return { geometry: geojson };
  }

  /**
   * Validate that all requested layer paths exist in the Zarr store before submitting to Prefect.
   *
   * @param {CreateTaskRequest} request
   * @return {*}  {Promise<void>}
   * @memberof TaskOrchestratorService
   */
  private async validateLayerPaths(request: CreateTaskRequest): Promise<void> {
    const layerPaths = new Set<string>();

    request.layers.forEach((layer) => {
      layerPaths.add(layer.layer_name);
    });

    if (request.budget?.layer_name) {
      layerPaths.add(request.budget.layer_name);
    }

    if (!layerPaths.size) {
      throw new ApiGeneralError('Task must include at least one layer path to submit.');
    }

    const invalidPaths = Array.from(layerPaths).filter((path) => !path.includes('/'));
    if (invalidPaths.length) {
      throw new ApiGeneralError('Invalid layer path format. Expected group/variable path.', invalidPaths);
    }

    const layerService = new LayerService();
    const lookups = await Promise.all(
      Array.from(layerPaths).map(async (path) => {
        const found = await layerService.getLayerByPath(path);
        return { path, found };
      })
    );

    const missingPaths = lookups.filter((item) => !item.found).map((item) => item.path);

    if (missingPaths.length) {
      throw new ApiGeneralError('One or more layer paths were not found in the Zarr store.', missingPaths);
    }
  }

  /**
   * Replaces all task layer configuration for a task with the provided request.
   *
   * @private
   * @param {string} taskId
   * @param {SubmitTaskRequest} request
   * @return {*}  {Promise<void>}
   * @memberof TaskOrchestratorService
   */
  private async replaceTaskLayers(
    taskId: string,
    request: {
      layers: {
        layer_name: string;
        description: string | null;
        mode: 'flexible' | 'locked-in' | 'locked-out';
        importance?: number | null;
        threshold?: number | null;
        constraints: {
          type: 'percent' | 'unit';
          min?: number | null;
          max?: number | null;
        }[];
      }[];
      budget?: {
        layer_name: string;
        description: string | null;
        mode: 'flexible' | 'locked-in' | 'locked-out';
        importance?: number | null;
        threshold?: number | null;
        constraints: {
          type: 'percent' | 'unit';
          min?: number | null;
          max?: number | null;
        }[];
      };
    }
  ): Promise<void> {
    await this.taskLayerConstraintService.deleteTaskLayerConstraintsByTaskId(taskId);
    await this.taskLayerService.deleteTaskLayersByTaskId(taskId);

    for (const layer of request.layers) {
      const layerData: CreateTaskLayer = {
        task_id: taskId,
        layer_name: layer.layer_name,
        description: layer.description ?? null,
        mode: layer.mode,
        importance: layer.importance ?? null,
        threshold: layer.threshold ?? null
      };

      const createdLayer = await this.taskLayerService.createTaskLayer(layerData);

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

    if (!request.budget) {
      return;
    }

    const budgetLayerData: CreateTaskLayer = {
      task_id: taskId,
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

  /**
   * Replaces task geometry associations for a task.
   *
   * @private
   * @param {string} taskId
   * @param {{ name?: string | null; description?: string | null; geojson: { geometry: unknown; [key: string]: unknown } }[]} geometryRequest
   * @return {*}  {Promise<void>}
   * @memberof TaskOrchestratorService
   */
  private async replaceTaskGeometry(
    taskId: string,
    geometryRequest: {
      name?: string | null;
      description?: string | null;
      geojson: { geometry: unknown; [key: string]: unknown };
    }[]
  ): Promise<void> {
    await this.taskGeometryService.deleteTaskGeometriesByTaskId(taskId);

    if (!geometryRequest.length) {
      return;
    }

    for (const [index, geometry] of geometryRequest.entries()) {
      const geometryPayload: CreateGeometry = {
        name: geometry.name?.trim() || `Geometry ${index + 1}`,
        description: geometry.description ?? null,
        geojson: geometry.geojson
      };

      const createdGeometry = await this.geometryService.createGeometry(geometryPayload);
      await this.taskGeometryService.createTaskGeometry({
        task_id: taskId,
        geometry_id: createdGeometry.geometry_id
      });
    }
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
