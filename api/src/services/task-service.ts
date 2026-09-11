import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { ApiPaginationOptions, ApiPaginationResults } from '../models/pagination';
import { CreateTask, DeleteTask, Task, TaskStatus, UpdateTask, UpdateTaskExecution } from '../models/task';
import { TaskExportWithFiles } from '../models/task-export.interface';
import { TaskRun } from '../models/task-run';
import { TaskRunArea } from '../models/task-run-area';
import { TaskRunWithArtifacts } from '../models/task-run.interface';
import { TaskDetails } from '../models/task.interface';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { DashboardTaskRepository } from '../repositories/dashboard-task-repository';
import { ProfileRepository } from '../repositories/profile-repository';
import { ProjectRepository } from '../repositories/project-repository';
import { TaskExportFileRepository } from '../repositories/task-export-file-repository';
import { TaskExportRepository } from '../repositories/task-export-repository';
import { TaskRepository } from '../repositories/task-repository';
import { TaskRunAreaRepository } from '../repositories/task-run-area-repository';
import { TaskRunRepository } from '../repositories/task-run-repository';
import { TaskRunSolutionRepository } from '../repositories/task-run-solution-repository';
import { TaskTileRepository } from '../repositories/task-tile-repository';
import { TASK_STATUS, TILE_STATUS } from '../types/status';
import { TaskStatusMessage } from '../types/task-status';
import { normalizeInviteEmails } from '../utils/invite';
import { makePaginationResponse } from '../utils/pagination';
import { toPresignedPmtilesUrl } from '../utils/pmtiles';
import { normalizeTaskStatus, normalizeTileStatus } from '../utils/status';
import { TASK_ROLE } from './authorization-service.interface';
import { DBService } from './db-service';
import { InviteProfilesResult } from './invite-profiles.interface';
import { PrefectService } from './prefect-service';
import { TaskPermissionService } from './task-permission-service';
import { TaskProfileService } from './task-profile-service';
import { TaskTileService } from './task-tile-service';

/**
 * Service for managing task data.
 *
 * @export
 * @class TaskService
 * @extends {DBService}
 */
export class TaskService extends DBService {
  taskRepository: TaskRepository;
  taskTileRepository: TaskTileRepository;
  taskTileService: TaskTileService;
  taskProfileService: TaskProfileService;
  taskPermissionService: TaskPermissionService;
  profileRepository: ProfileRepository;
  projectRepository: ProjectRepository;
  dashboardTaskRepository: DashboardTaskRepository;
  taskExportRepository: TaskExportRepository;
  taskExportFileRepository: TaskExportFileRepository;
  taskRunRepository: TaskRunRepository;
  taskRunAreaRepository: TaskRunAreaRepository;
  artifactRepository: ArtifactRepository;
  taskRunSolutionRepository: TaskRunSolutionRepository;

  /**
   * Creates an instance of TaskService.
   *
   * @param {IDBConnection} connection - The database connection object.
   * @memberof TaskService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.taskRepository = new TaskRepository(connection);
    this.taskTileRepository = new TaskTileRepository(connection);
    this.taskTileService = new TaskTileService(connection);
    this.taskProfileService = new TaskProfileService(connection);
    this.taskPermissionService = new TaskPermissionService(connection);
    this.profileRepository = new ProfileRepository(connection);
    this.projectRepository = new ProjectRepository(connection);
    this.dashboardTaskRepository = new DashboardTaskRepository(connection);
    this.taskExportRepository = new TaskExportRepository(connection);
    this.taskExportFileRepository = new TaskExportFileRepository(connection);
    this.taskRunRepository = new TaskRunRepository(connection);
    this.taskRunAreaRepository = new TaskRunAreaRepository(connection);
    this.artifactRepository = new ArtifactRepository(connection);
    this.taskRunSolutionRepository = new TaskRunSolutionRepository(connection);
  }

  /**
   * Sends an abort request to the flow currently associated with a task.
   *
   * @param {string} taskId Task whose Prefect flow should be cancelled.
   * @returns {Promise<void>} Resolves when the operation completes.
   * @throws {ApiConflictError} If the task is completed or has no dispatched flow.
   * @throws {ApiConflictError} Completed tasks cannot be aborted.
   * @throws {ApiConflictError} This task has no dispatched flow to abort.
   */
  async abortTask(taskId: string): Promise<void> {
    const task = await this.taskRepository.getTaskById(taskId);
    if (task.status === TASK_STATUS.ABORTED) {
      return;
    }
    if (task.status === TASK_STATUS.COMPLETED) {
      throw new ApiConflictError('Completed tasks cannot be aborted.');
    }
    if (!task.prefect_flow_run_id) {
      throw new ApiConflictError('This task has no dispatched flow to abort.');
    }
    await new PrefectService().cancelFlowRun(task.prefect_flow_run_id);
    await this.taskRepository.updateTaskExecution(taskId, {
      status: TASK_STATUS.ABORTED,
      status_message: 'Abort requested. The workflow may still be stopping.'
    });
  }

  /**
   * Creates a new task.
   *
   * @param {CreateTask} task - The data for the new task (excluding `task_id`).
   * @return {Promise<Task>} The newly created task.
   * @memberof TaskService
   */
  async createTask(task: CreateTask): Promise<Task> {
    return this.taskRepository.createTask(task);
  }

  /**
   * Gets a task by its ID.
   *
   * @param {string} taskId - The UUID of the task.
   * @return {Promise<Task>} The task with the provided ID.
   * @memberof TaskService
   */
  async getTaskById(taskId: string): Promise<TaskDetails> {
    const task = await this.taskRepository.getTaskById(taskId);
    const taskProjects = await this.projectRepository.getProjectsByTaskIds([taskId]);
    const dashboardId = await this.dashboardTaskRepository.getLatestDashboardIdForTask(taskId);
    const tilesetUri = await this.toPresignedTilesetUri(task.tileset_uri);
    const latestRunsByTaskId = await this.buildLatestRunsByTaskId([taskId]);

    // Generate presigned URL

    return {
      ...task,
      tileset_uri: tilesetUri,
      projects: taskProjects.map((project) => ({
        project_id: project.project_id,
        name: project.name,
        description: project.description,
        colour: project.colour
      })),
      dashboard_id: dashboardId ?? null,
      latest_run: latestRunsByTaskId.get(taskId) ?? null
    };
  }

  /**
   * Gets all active tasks (where `record_end_date` is `NULL`).
   *
   * @return {Promise<Task[]>} A list of all active tasks.
   * @memberof TaskService
   */
  async getAllTasks(): Promise<TaskDetails[]> {
    const tasks = await this.taskRepository.getAllTasks();
    const taskIds = tasks.map((task) => task.task_id);

    if (!taskIds.length) {
      return [];
    }

    const projectsByTaskId = await this.buildProjectsByTaskId(taskIds);
    const latestRunsByTaskId = await this.buildLatestRunsByTaskId(taskIds);

    return Promise.all(
      tasks.map(async (task) => ({
        ...task,
        tileset_uri: await this.toPresignedTilesetUri(task.tileset_uri),
        projects: projectsByTaskId.get(task.task_id) ?? [],
        latest_run: latestRunsByTaskId.get(task.task_id) ?? null
      }))
    );
  }

  /**
   * Gets all tasks available to the profile ID.
   *
   * @param {string} profileId Identifier of the profile whose access or records are used.
   * @returns {Promise<TaskDetails[]>} Matching task details records.
   * @memberof TaskService
   */
  async getTasksForProfile(profileId: string): Promise<TaskDetails[]> {
    const tasks = await this.taskRepository.getTasksByProfileId(profileId);
    const taskIds = tasks.map((task) => task.task_id);

    if (!taskIds.length) {
      return [];
    }

    const projectsByTaskId = await this.buildProjectsByTaskId(taskIds);
    const latestRunsByTaskId = await this.buildLatestRunsByTaskId(taskIds);

    return Promise.all(
      tasks.map(async (task) => ({
        ...task,
        tileset_uri: await this.toPresignedTilesetUri(task.tileset_uri),
        projects: projectsByTaskId.get(task.task_id) ?? [],
        latest_run: latestRunsByTaskId.get(task.task_id) ?? null
      }))
    );
  }

  /**
   * Gets all tasks available to the profile ID with pagination.
   *
   * @param {string} profileId Identifier of the profile whose access or records are used.
   * @param {ApiPaginationOptions} pagination Page, page-size, and sorting options.
   * @param {string} search Optional search text used to filter matching records.
   * @returns {Promise<{ tasks: TaskDetails[]; pagination: ApiPaginationResults }>} Tasks visible to the profile, with pagination metadata.
   * @memberof TaskService
   */
  async getTasksForProfilePaginated(
    profileId: string,
    pagination: ApiPaginationOptions,
    search?: string
  ): Promise<{ tasks: TaskDetails[]; pagination: ApiPaginationResults }> {
    const { tasks, total } = await this.taskRepository.getTasksByProfileIdPaginated(profileId, pagination, search);
    const taskIds = tasks.map((task) => task.task_id);

    if (!taskIds.length) {
      return { tasks: [], pagination: makePaginationResponse(total, pagination) };
    }

    const projectsByTaskId = await this.buildProjectsByTaskId(taskIds);
    const latestRunsByTaskId = await this.buildLatestRunsByTaskId(taskIds);

    const populatedTasks = await Promise.all(
      tasks.map(async (task) => ({
        ...task,
        tileset_uri: await this.toPresignedTilesetUri(task.tileset_uri),
        projects: projectsByTaskId.get(task.task_id) ?? [],
        latest_run: latestRunsByTaskId.get(task.task_id) ?? null
      }))
    );

    return {
      tasks: populatedTasks,
      pagination: makePaginationResponse(total, pagination)
    };
  }

  /**
   * Gets all tasks associated with a project.
   *
   * @param {string} projectId Identifier of the project.
   * @returns {Promise<TaskDetails[]>} Matching task details records.
   * @memberof TaskService
   */
  async getTasksForProject(projectId: string): Promise<TaskDetails[]> {
    const tasks = await this.taskRepository.getTasksByProjectId(projectId);
    const taskIds = tasks.map((task) => task.task_id);

    if (!taskIds.length) {
      return [];
    }

    const projectsByTaskId = await this.buildProjectsByTaskId(taskIds);
    const latestRunsByTaskId = await this.buildLatestRunsByTaskId(taskIds);

    return Promise.all(
      tasks.map(async (task) => ({
        ...task,
        tileset_uri: await this.toPresignedTilesetUri(task.tileset_uri),
        projects: projectsByTaskId.get(task.task_id) ?? [],
        latest_run: latestRunsByTaskId.get(task.task_id) ?? null
      }))
    );
  }

  /**
   * Convert a stored tileset URI into a presigned PMTiles URL.
   *
   * @param {string | null | undefined} uri Stored PMTiles object URI, or null when no tileset has been published.
   * @returns {Promise<string | null>} Presigned PMTiles URL suitable for frontend display, or null for empty input.
   */
  private async toPresignedTilesetUri(uri: string | null | undefined): Promise<string | null> {
    return toPresignedPmtilesUrl(uri);
  }

  /**
   * Builds latest task runs by task ID with artifacts, solutions, and exports.
   *
   * @param {string[]} taskIds Task IDs whose latest immutable runs should be loaded.
   * @returns {Promise<Map<string, TaskRunWithArtifacts>>} Latest run metadata keyed by parent task ID.
   * @throws {ApiExecuteSQLError} When run, artifact, solution, export, or area records cannot be queried.
   */
  private async buildLatestRunsByTaskId(taskIds: string[]): Promise<Map<string, TaskRunWithArtifacts>> {
    const latestRuns = (
      await Promise.all(taskIds.map(async (taskId) => this.taskRunRepository.getLatestTaskRunByTaskId(taskId)))
    ).filter((run): run is TaskRun => Boolean(run));
    const exportsByRunId = await this.buildExportsByRunId(latestRuns.map((run) => run.task_run_id));
    const areasByRunId = await this.buildAreasByRunId(latestRuns.map((run) => run.task_run_id));
    const latestRunsByTaskId = new Map<string, TaskRunWithArtifacts>();

    for (const run of latestRuns) {
      const artifacts = await this.artifactRepository.getArtifactsByRunId(run.task_run_id);
      const solutions = await this.taskRunSolutionRepository.getTaskRunSolutions(run.task_run_id);
      latestRunsByTaskId.set(run.task_id, {
        ...run,
        areas: areasByRunId.get(run.task_run_id) ?? [],
        exports: exportsByRunId.get(run.task_run_id) ?? [],
        solutions,
        artifacts: await Promise.all(
          artifacts.map(async (artifact) => ({
            ...artifact,
            uri: artifact.type === 'pmtiles' ? await toPresignedPmtilesUrl(artifact.uri) : artifact.uri
          }))
        )
      });
    }

    return latestRunsByTaskId;
  }

  /**
   * Builds task-run areas grouped by parent run ID.
   *
   * @param {string[]} taskRunIds Task run IDs whose persisted target areas should be loaded.
   * @returns {Promise<Map<string, TaskRunArea[]>>} Target-area features keyed by parent task run ID.
   * @throws {ApiExecuteSQLError} When target-area records cannot be queried.
   */
  private async buildAreasByRunId(taskRunIds: string[]): Promise<Map<string, TaskRunArea[]>> {
    const areas = await this.taskRunAreaRepository.getTaskRunAreasByRunIds(taskRunIds);
    const areasByRunId = new Map<string, typeof areas>();

    for (const area of areas) {
      const existing = areasByRunId.get(area.task_run_id) ?? [];
      existing.push(area);
      areasByRunId.set(area.task_run_id, existing);
    }

    return areasByRunId;
  }

  /**
   * Builds task exports with files grouped by parent run ID.
   *
   * @param {string[]} taskRunIds Task run IDs whose export jobs should be loaded.
   * @returns {Promise<Map<string, TaskExportWithFiles[]>>} Exports with files keyed by parent task run ID.
   * @throws {ApiExecuteSQLError} When export or export-file records cannot be queried.
   */
  private async buildExportsByRunId(taskRunIds: string[]): Promise<Map<string, TaskExportWithFiles[]>> {
    const exports = await this.taskExportRepository.getTaskExportsByRunIds(taskRunIds);
    const files = await this.taskExportFileRepository.getTaskExportFilesByExportIds(
      exports.map((taskExport) => taskExport.task_export_id)
    );
    const filesByExportId = new Map<string, typeof files>();
    const exportsByRunId = new Map<string, TaskExportWithFiles[]>();

    for (const file of files) {
      const existing = filesByExportId.get(file.task_export_id) ?? [];
      existing.push(file);
      filesByExportId.set(file.task_export_id, existing);
    }

    for (const taskExport of exports) {
      const existing = exportsByRunId.get(taskExport.task_run_id) ?? [];
      existing.push({
        ...taskExport,
        files: filesByExportId.get(taskExport.task_export_id) ?? []
      });
      exportsByRunId.set(taskExport.task_run_id, existing);
    }

    return exportsByRunId;
  }

  /**
   * Build a map of task IDs to project summaries.
   *
   * @param {string[]} taskIds Identifiers of the tasks to process.
   * @returns {Promise<Map<string, { project_id: string; name: string; description: string | null; colour: string }[]>>} Project summaries grouped by their task identifiers.
   * @memberof TaskService
   */
  private async buildProjectsByTaskId(
    taskIds: string[]
  ): Promise<Map<string, { project_id: string; name: string; description: string | null; colour: string }[]>> {
    const taskProjects = await this.projectRepository.getProjectsByTaskIds(taskIds);
    const projectsByTaskId = new Map<
      string,
      { project_id: string; name: string; description: string | null; colour: string }[]
    >();

    for (const project of taskProjects) {
      const existing = projectsByTaskId.get(project.task_id) ?? [];
      existing.push({
        project_id: project.project_id,
        name: project.name,
        description: project.description,
        colour: project.colour
      });
      projectsByTaskId.set(project.task_id, existing);
    }

    return projectsByTaskId;
  }

  /**
   * Updates an existing task.
   *
   * @param {string} taskId - The UUID of the task to update.
   * @param {UpdateTask} updates - The fields to update in the task record.
   * @return {Promise<Task>} The updated task.
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
   * @return {Promise<Task>} The updated task.
   * @memberof TaskService
   */
  async updateTaskExecution(taskId: string, updates: UpdateTaskExecution): Promise<Task> {
    return this.taskRepository.updateTaskExecution(taskId, updates);
  }

  /**
   * Adds the creator of a task as an admin.
   *
   * @param {string} taskId Identifier of the task.
   * @param {string} profileId Identifier of the profile whose access or records are used.
   * @returns {Promise<void>} Resolves when the operation completes.
   * @memberof TaskService
   */
  async addCreatorAsAdmin(taskId: string, profileId: string): Promise<void> {
    await this.taskProfileService.createTaskProfile({
      task_id: taskId,
      profile_id: profileId
    });

    const adminRoleId = await this.profileRepository.getRoleIdByNameAndScope(TASK_ROLE.TASK_ADMIN, 'task');

    await this.taskPermissionService.createTaskPermission({
      task_id: taskId,
      profile_id: profileId,
      role_id: adminRoleId
    });
  }

  /**
   * Resets execution metadata for a task and sets a new status.
   *
   * @param {string} taskId Identifier of the task.
   * @param {TaskStatus} status Lifecycle status to apply or inspect.
   * @returns {Promise<Task>} The task after clearing its previous execution state.
   * @memberof TaskService
   */
  async resetExecutionState(taskId: string, status: TaskStatus): Promise<Task> {
    return this.updateTaskExecution(taskId, {
      status,
      status_message: null,
      prefect_flow_run_id: null,
      prefect_deployment_id: null,
      tileset_uri: null,
      output_uri: null
    });
  }

  /**
   * Adds existing profiles to a task by email address.
   *
   * @param {string} taskId Identifier of the task.
   * @param {string[]} emails Email addresses of the profiles to invite.
   * @returns {Promise<InviteProfilesResult>} Invitation results identifying added, existing, and unresolved profiles.
   * @memberof TaskService
   */
  async inviteProfilesToTask(taskId: string, emails: string[]): Promise<InviteProfilesResult> {
    const normalizedEmails = normalizeInviteEmails(emails);

    if (!normalizedEmails.length) {
      return { added_profile_ids: [], skipped_emails: [] };
    }

    const profiles = await Promise.all(
      normalizedEmails.map((email) => this.profileRepository.findProfileByEmail(email))
    );

    const profilesByEmail = new Map<string, string>();
    const skippedEmails: string[] = [];

    normalizedEmails.forEach((email, index) => {
      const profile = profiles[index];
      if (profile?.profile_id) {
        profilesByEmail.set(email, profile.profile_id);
      } else {
        skippedEmails.push(email);
      }
    });

    if (!profilesByEmail.size) {
      return { added_profile_ids: [], skipped_emails: skippedEmails };
    }

    const existingProfiles = await this.taskProfileService.getTaskProfilesByTaskId(taskId);
    const existingProfileIds = new Set(existingProfiles.map((profile) => profile.profile_id));
    const memberRoleId = await this.profileRepository.getRoleIdByNameAndScope(TASK_ROLE.TASK_USER, 'task');

    const addedProfileIds: string[] = [];

    for (const profileId of profilesByEmail.values()) {
      if (existingProfileIds.has(profileId)) {
        continue;
      }

      await this.taskProfileService.createTaskProfile({
        task_id: taskId,
        profile_id: profileId
      });

      await this.taskPermissionService.createTaskPermission({
        task_id: taskId,
        profile_id: profileId,
        role_id: memberRoleId
      });

      addedProfileIds.push(profileId);
    }

    return { added_profile_ids: addedProfileIds, skipped_emails: skippedEmails };
  }

  /**
   * Updates task status from internal workflows and returns the hydrated task.
   *
   * @param {string} taskId Identifier of the task.
   * @param {UpdateTaskExecution} updates Fields to update on the existing record.
   * @returns {Promise<TaskDetails>} The task after applying the lifecycle update.
   * @memberof TaskService
   */
  async updateTaskStatus(taskId: string, updates: UpdateTaskExecution): Promise<TaskDetails> {
    await this.taskRepository.updateTaskExecution(taskId, updates);
    await this.submitTileJobIfCompleted(taskId, updates);
    return this.getTaskById(taskId);
  }

  /**
   * Submits a tile job when a task reaches COMPLETED, ensuring idempotency.
   *
   * @param {string} taskId Identifier of the task.
   * @param {UpdateTaskExecution} updates Fields to update on the existing record.
   * @returns {Promise<void>} Resolves when the operation completes.
   * @memberof TaskService
   */
  async submitTileJobIfCompleted(taskId: string, updates: UpdateTaskExecution): Promise<void> {
    if (updates.status !== TASK_STATUS.COMPLETED) {
      return;
    }

    const existingTile = await this.taskTileRepository.getLatestTaskTileByTaskId(taskId);
    const normalizedStatus = normalizeTileStatus(existingTile?.status ?? null);

    if (normalizedStatus && (normalizedStatus === TILE_STATUS.DRAFT || normalizedStatus === TILE_STATUS.STARTED)) {
      return;
    }

    await this.taskTileService.createDraftTileAndSubmit(taskId);
  }

  /**
   * Soft deletes a task.
   *
   * @param {DeleteTask} data - The data for the task to delete.
   * @returns {Promise<void>} Resolves when the operation completes.
   * @memberof TaskService
   */
  async deleteTask(data: DeleteTask): Promise<void> {
    return this.taskRepository.deleteTask(data);
  }

  /**
   * Fetches a snapshot of task status and tile state for websocket updates.
   *
   * @param {string} taskId Identifier of the task.
   * @returns {Promise<TaskStatusMessage>} Current task status, run progress, and publication details.
   * @throws {Error} Unrecognized task status value.
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
    const latestRun = await this.taskRunRepository.getLatestTaskRunByTaskId(taskId);
    const runArtifacts = latestRun ? await this.artifactRepository.getArtifactsByRunId(latestRun.task_run_id) : [];
    const runPmtiles = runArtifacts.find((artifact) => artifact.type === 'pmtiles');
    const tileUri = await toPresignedPmtilesUrl(tile?.pmtiles_uri ?? runPmtiles?.uri ?? null);

    const normalizedStatus = normalizeTaskStatus(task.status);
    const runArtifactTileStatus =
      runPmtiles?.status === 'pending'
        ? TILE_STATUS.DRAFT
        : runPmtiles?.status === 'building'
        ? TILE_STATUS.STARTED
        : runPmtiles?.status === 'ready'
        ? TILE_STATUS.COMPLETED
        : runPmtiles?.status === 'failed'
        ? TILE_STATUS.FAILED
        : null;
    const normalizedTileStatus = normalizeTileStatus(tile?.status ?? runArtifactTileStatus);

    if (!normalizedStatus) {
      throw new Error('Unrecognized task status value.');
    }

    return {
      task_id: task.task_id,
      status: normalizedStatus,
      output_uri: task.output_uri ?? null,
      tile:
        tile || runPmtiles
          ? {
              status: normalizedTileStatus ?? TILE_STATUS.FAILED,
              pmtiles_uri: tileUri
            }
          : null
    };
  }
}
