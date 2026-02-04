import { IDBConnection } from '../database/db';
import { HTTP403, HTTP404 } from '../errors/http-error';
import { SYSTEM_ROLE } from '../constants/roles';
import { CreateDashboard, Dashboard } from '../models/dashboard';
import { DashboardPermissionRepository } from '../repositories/dashboard-permission-repository';
import { DashboardRepository } from '../repositories/dashboard-repository';
import { DashboardTaskRepository } from '../repositories/dashboard-task-repository';
import { ProfileRepository } from '../repositories/profile-repository';
import { TaskRepository } from '../repositories/task-repository';
import { TaskProfileService } from './task-profile-service';
import { DBService } from './db-service';

export interface DashboardResponse {
  dashboard: Dashboard;
  task_ids: string[];
}

/**
 * Service for managing dashboards and publish workflow.
 *
 * @export
 * @class DashboardService
 * @extends {DBService}
 */
export class DashboardService extends DBService {
  dashboardRepository: DashboardRepository;
  dashboardTaskRepository: DashboardTaskRepository;
  dashboardPermissionRepository: DashboardPermissionRepository;
  profileRepository: ProfileRepository;
  taskRepository: TaskRepository;
  taskProfileService: TaskProfileService;

  /**
   * Creates an instance of DashboardService.
   *
   * @param {IDBConnection} connection
   * @memberof DashboardService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.dashboardRepository = new DashboardRepository(connection);
    this.dashboardTaskRepository = new DashboardTaskRepository(connection);
    this.dashboardPermissionRepository = new DashboardPermissionRepository(connection);
    this.profileRepository = new ProfileRepository(connection);
    this.taskRepository = new TaskRepository(connection);
    this.taskProfileService = new TaskProfileService(connection);
  }

  /**
   * Publish a task to a new dashboard with default permissions (Only Me).
   *
   * @param {string} taskId
   * @param {string} profileId
   * @return {*}  {Promise<DashboardResponse>}
   * @memberof DashboardService
   */
  async publishTaskToDashboard(
    taskId: string,
    profileId: string,
    name: string,
    accessScheme: 'ANYONE_WITH_LINK' | 'MEMBERS_ONLY' | 'NOBODY'
  ): Promise<DashboardResponse> {
    const task = await this.taskRepository.getTaskById(taskId);
    const role = await this.taskProfileService.getRoleForTaskProfile(taskId, profileId);

    if (!role) {
      throw new HTTP403('Access denied.');
    }

    const dashboardPayload: CreateDashboard = {
      name,
      description: task.description ?? null,
      access_scheme: accessScheme
    };

    const dashboard = await this.dashboardRepository.createDashboard(dashboardPayload);

    await this.dashboardTaskRepository.addTaskToDashboard({
      dashboard_id: dashboard.dashboard_id,
      task_id: task.task_id
    });

    const dashboardRoleId = await this.profileRepository.getRoleIdByNameAndScope(SYSTEM_ROLE.MEMBER, 'dashboard');

    await this.dashboardPermissionRepository.upsertDashboardPermission({
      dashboard_id: dashboard.dashboard_id,
      profile_id: profileId,
      role_id: dashboardRoleId
    });

    return {
      dashboard,
      task_ids: [task.task_id]
    };
  }

  /**
   * Fetch the most recent dashboard associated with a task, enforcing access rules.
   *
   * @param {string} taskId
   * @param {string} profileId
   * @return {*}  {Promise<DashboardResponse>}
   * @memberof DashboardService
   */
  async getLatestDashboardForTask(taskId: string, profileId: string): Promise<DashboardResponse> {
    const role = await this.taskProfileService.getRoleForTaskProfile(taskId, profileId);

    if (!role) {
      throw new HTTP403('Access denied.');
    }

    const dashboardId = await this.dashboardTaskRepository.getLatestDashboardIdForTask(taskId);

    if (!dashboardId) {
      throw new HTTP404('Dashboard not found.');
    }

    return this.getDashboardWithTasks(dashboardId, profileId);
  }

  /**
   * Fetch a dashboard and its tasks, enforcing access rules.
   *
   * @param {string} dashboardId
   * @param {string} profileId
   * @return {*}  {Promise<DashboardResponse>}
   * @memberof DashboardService
   */
  async getDashboardWithTasks(dashboardId: string, profileId?: string | null): Promise<DashboardResponse> {
    const dashboard = await this.dashboardRepository.findDashboardById(dashboardId);

    if (!dashboard) {
      throw new HTTP404('Dashboard not found.');
    }

    if (dashboard.access_scheme === 'NOBODY') {
      if (!profileId) {
        throw new HTTP404('Dashboard not found.');
      }
      throw new HTTP403('Access denied.');
    }

    if (dashboard.access_scheme === 'MEMBERS_ONLY') {
      if (!profileId) {
        throw new HTTP404('Dashboard not found.');
      }

      const permission = await this.dashboardPermissionRepository.getDashboardPermission(dashboardId, profileId);
      if (!permission) {
        throw new HTTP403('Access denied.');
      }
    }

    const taskIds = await this.dashboardTaskRepository.listTaskIdsForDashboard(dashboardId);

    return {
      dashboard,
      task_ids: taskIds
    };
  }
}
