import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { CreateTask, TaskStatus, UpdateTask } from '../models/task';
import { CreateTaskDraftRequest, SubmitTaskRequest } from '../models/task-orchestrator';
import { TaskDetails } from '../models/task.interface';
import { TASK_STATUS } from '../types/status';
import { DBService } from './db-service';
import { TaskService } from './task-service';

/** Coordinates task metadata; immutable optimization problems belong to task runs. */
export class TaskOrchestratorService extends DBService {
  private taskService: TaskService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.taskService = new TaskService(connection);
  }

  /** Create an empty optimization task draft. */
  async createDraftTask(request: CreateTaskDraftRequest, profileId?: string | null): Promise<TaskDetails> {
    const taskData: CreateTask = {
      type: request.type ?? 'discrete_optimization',
      name: request.name,
      description: request.description ?? null,
      resolution: request.planning_unit_resolution ?? request.resolution ?? null,
      resampling: request.resampling ?? null,
      status: TASK_STATUS.DRAFT
    };
    const task = await this.taskService.createTask(taskData);
    if (profileId) {
      await this.taskService.addCreatorAsAdmin(task.task_id, profileId);
    }
    return this.taskService.getTaskById(task.task_id);
  }

  /** Persist only authoring metadata before an immutable run is created. */
  async configureTaskForRun(taskId: string, request: SubmitTaskRequest): Promise<TaskDetails> {
    const updates: UpdateTask = {};
    const planningUnitResolution = request.planning_unit_resolution ?? request.resolution;
    if (planningUnitResolution !== undefined && planningUnitResolution !== null) {
      updates.resolution = planningUnitResolution;
    }
    if (request.resampling !== undefined) {
      updates.resampling = request.resampling;
    }
    if (Object.keys(updates).length > 0) {
      await this.taskService.updateTask(taskId, updates);
    }
    return this.taskService.getTaskById(taskId);
  }

  /** Reset a failed task to draft; resubmission requires a new explicit problem. */
  async retryTask(taskId: string, status: TaskStatus): Promise<TaskDetails> {
    if (status !== 'draft') {
      throw new ApiGeneralError('A failed optimization must be returned to draft and submitted explicitly.', []);
    }
    await this.taskService.resetExecutionState(taskId, 'draft');
    return this.taskService.getTaskById(taskId);
  }
}
