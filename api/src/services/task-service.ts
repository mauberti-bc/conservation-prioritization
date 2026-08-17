import { IDBConnection } from '../database/db';
import { ApiPaginationOptions, ApiPaginationResults } from '../models/pagination';
import { CreateTask, DeleteTask, Task, TaskStatus, UpdateTask, UpdateTaskExecution } from '../models/task';
import { TaskRunWithArtifacts } from '../models/task-run.interface';
import { TaskDetails } from '../models/task.interface';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { DashboardTaskRepository } from '../repositories/dashboard-task-repository';
import { ProfileRepository } from '../repositories/profile-repository';
import { ProjectRepository } from '../repositories/project-repository';
import { TaskRepository } from '../repositories/task-repository';
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
  taskRunRepository: TaskRunRepository;
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
    this.taskRunRepository = new TaskRunRepository(connection);
    this.artifactRepository = new ArtifactRepository(connection);
    this.taskRunSolutionRepository = new TaskRunSolutionRepository(connection);
  }

  /**
   * Creates a new task.
   *
   * @param {CreateTask} task - The data for the new task (excluding `task_id`).
   * @return {*} {Promise<Task>} The newly created task.
   * @memberof TaskService
   */
  async createTask(task: CreateTask): Promise<Task> {
    return this.taskRepository.createTask(task);
  }

  /**
   * Gets a task by its ID.
   *
   * @param {string} taskId - The UUID of the task.
   * @return {*} {Promise<Task>} The task with the provided ID.
   * @memberof TaskService
   */
  async getTaskById(taskId: string): Promise<TaskDetails> {
    const task = await this.taskRepository.getTaskById(taskId);
    const taskProjects = await this.projectRepository.getProjectsByTaskIds([taskId]);
    const dashboardId = await this.dashboardTaskRepository.getLatestDashboardIdForTask(taskId);
    const tilesetUri = await this.toPresignedTilesetUri(task.tileset_uri);
    const latestRun = await this.getLatestTaskRunWithArtifacts(taskId);

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
      latest_run: latestRun
    };
  }

  /**
   * Gets all active tasks (where `record_end_date` is `NULL`).
   *
   * @return {*} {Promise<Task[]>} A list of all active tasks.
   * @memberof TaskService
   */
  async getAllTasks(): Promise<TaskDetails[]> {
    const tasks = await this.taskRepository.getAllTasks();
    const taskIds = tasks.map((task) => task.task_id);

    if (!taskIds.length) {
      return [];
    }

    const projectsByTaskId = await this.buildProjectsByTaskId(taskIds);

    return Promise.all(
      tasks.map(async (task) => ({
        ...task,
        tileset_uri: await this.toPresignedTilesetUri(task.tileset_uri),
        projects: projectsByTaskId.get(task.task_id) ?? [],
        latest_run: await this.getLatestTaskRunWithArtifacts(task.task_id)
      }))
    );
  }

  /**
   * Gets all tasks available to the profile ID.
   *
   * @param {string} profileId
   * @return {*}  {Promise<TaskWithLayers[]>}
   * @memberof TaskService
   */
  async getTasksForProfile(profileId: string): Promise<TaskDetails[]> {
    const tasks = await this.taskRepository.getTasksByProfileId(profileId);
    const taskIds = tasks.map((task) => task.task_id);

    if (!taskIds.length) {
      return [];
    }

    const projectsByTaskId = await this.buildProjectsByTaskId(taskIds);

    return Promise.all(
      tasks.map(async (task) => ({
        ...task,
        tileset_uri: await this.toPresignedTilesetUri(task.tileset_uri),
        projects: projectsByTaskId.get(task.task_id) ?? [],
        latest_run: await this.getLatestTaskRunWithArtifacts(task.task_id)
      }))
    );
  }

  /**
   * Gets all tasks available to the profile ID with pagination.
   *
   * @param {string} profileId
   * @param {ApiPaginationOptions} pagination
   * @return {*}  {Promise<{ tasks: TaskWithLayers[]; pagination: ApiPaginationResults }>}
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

    const populatedTasks = await Promise.all(
      tasks.map(async (task) => ({
        ...task,
        tileset_uri: await this.toPresignedTilesetUri(task.tileset_uri),
        projects: projectsByTaskId.get(task.task_id) ?? [],
        latest_run: await this.getLatestTaskRunWithArtifacts(task.task_id)
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
   * @param {string} projectId
   * @return {*}  {Promise<TaskWithLayers[]>}
   * @memberof TaskService
   */
  async getTasksForProject(projectId: string): Promise<TaskDetails[]> {
    const tasks = await this.taskRepository.getTasksByProjectId(projectId);
    const taskIds = tasks.map((task) => task.task_id);

    if (!taskIds.length) {
      return [];
    }

    const projectsByTaskId = await this.buildProjectsByTaskId(taskIds);

    return Promise.all(
      tasks.map(async (task) => ({
        ...task,
        tileset_uri: await this.toPresignedTilesetUri(task.tileset_uri),
        projects: projectsByTaskId.get(task.task_id) ?? [],
        latest_run: await this.getLatestTaskRunWithArtifacts(task.task_id)
      }))
    );
  }

  /**
   * Convert a stored tileset URI into a presigned PMTiles URL.
   *
   * @param {string | null | undefined} uri
   * @return {*}  {Promise<string | null>}
   * @memberof TaskService
   */
  private async toPresignedTilesetUri(uri: string | null | undefined): Promise<string | null> {
    return toPresignedPmtilesUrl(uri);
  }

  /** Returns the latest run with authoritative artifacts for task compatibility responses. */
  private async getLatestTaskRunWithArtifacts(taskId: string): Promise<TaskRunWithArtifacts | null> {
    const run = await this.taskRunRepository.getLatestTaskRunByTaskId(taskId);
    if (!run) {
      return null;
    }
    const artifacts = await this.artifactRepository.getArtifactsByRunId(run.task_run_id);
    const solutions = await this.taskRunSolutionRepository.getTaskRunSolutions(run.task_run_id);
    return {
      ...run,
      solutions,
      artifacts: await Promise.all(
        artifacts.map(async (artifact) => ({
          ...artifact,
          uri: artifact.type === 'pmtiles' ? await toPresignedPmtilesUrl(artifact.uri) : artifact.uri
        }))
      )
    };
  }

  /**
   * Build a map of task IDs to project summaries.
   *
   * @param {string[]} taskIds
   * @return {*}  {Promise<Map<string, { project_id: string; name: string; description: string | null; colour: string }[]>>}
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
   * @return {*} {Promise<Task>} The updated task.
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
   * @return {*} {Promise<Task>} The updated task.
   * @memberof TaskService
   */
  async updateTaskExecution(taskId: string, updates: UpdateTaskExecution): Promise<Task> {
    return this.taskRepository.updateTaskExecution(taskId, updates);
  }

  /**
   * Adds the creator of a task as an admin.
   *
   * @param {string} taskId
   * @param {string} profileId
   * @return {*}  {Promise<void>}
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
   * @param {string} taskId
   * @param {TaskStatus} status
   * @return {*}  {Promise<Task>}
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
   * @param {string} taskId
   * @param {string[]} emails
   * @return {*}  {Promise<InviteProfilesResult>}
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
   * @param {string} taskId
   * @param {UpdateTaskExecution} updates
   * @return {*}  {Promise<TaskWithLayers>}
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
   * @param {string} taskId
   * @param {UpdateTaskExecution} updates
   * @return {*}  {Promise<void>}
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
   * @return {*} {Promise<void>} Resolves when the task is successfully deleted.
   * @memberof TaskService
   */
  async deleteTask(data: DeleteTask): Promise<void> {
    return this.taskRepository.deleteTask(data);
  }

  /**
   * Fetches a snapshot of task status and tile state for websocket updates.
   *
   * @param {string} taskId
   * @return {*}  {Promise<TaskStatusMessage>}
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
