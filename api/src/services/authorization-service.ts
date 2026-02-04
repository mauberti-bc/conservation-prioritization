import { IDBConnection } from '../database/db';
import {
  AuthorizeByProfile,
  AuthorizeByProject,
  AuthorizeByTask,
  AuthorizeRule,
  AuthorizationScheme
} from './authorization-service.interface';
import { SYSTEM_ROLE } from '../constants/roles';
import { getUserGuid } from '../utils/keycloak-utils';
import { DBService } from './db-service';
import { ProfileService } from './profile-service';
import { ProjectProfileService } from './project-profile-service';
import { ProjectService } from './project-service';
import { TaskProfileService } from './task-profile-service';
import { TaskService } from './task-service';

export class AuthorizationService extends DBService {
  private profileService: ProfileService;
  private taskService: TaskService;
  private taskProfileService: TaskProfileService;
  private projectService: ProjectService;
  private projectProfileService: ProjectProfileService;
  private keycloakToken: Record<string, any> | null;
  private profile: unknown;

  constructor(connection: IDBConnection, context?: { profile?: unknown; keycloakToken?: Record<string, any> | null }) {
    super(connection);
    this.profileService = new ProfileService(connection);
    this.taskService = new TaskService(connection);
    this.taskProfileService = new TaskProfileService(connection);
    this.projectService = new ProjectService(connection);
    this.projectProfileService = new ProjectProfileService(connection);
    this.keycloakToken = context?.keycloakToken ?? null;
    this.profile = context?.profile ?? null;
  }

  /**
   * Returns the profile attached to the current request context (if any).
   *
   * @return {*}  {unknown}
   * @memberof AuthorizationService
   */
  getProfile(): unknown {
    return this.profile;
  }

  /**
   * Returns true if the authenticated user has the system admin role.
   *
   * @return {*}  {Promise<boolean>}
   * @memberof AuthorizationService
   */
  async authorizeSystemAdministrator(): Promise<boolean> {
    const systemUserRoles = await this.getUserSystemRoles();
    return systemUserRoles.includes(SYSTEM_ROLE.ADMIN);
  }

  /**
   * Executes authorization checks based on the provided authorization rule.
   *
   * @param {AuthorizeRule} authorizeRule - The authorization rule containing the discriminator and necessary details.
   * @return {Promise<boolean>} - Returns a boolean indicating whether the authorization check passed.
   */
  async executeAuthorizationRule(authorizeRule: AuthorizeRule): Promise<boolean> {
    switch (authorizeRule.discriminator) {
      case 'Task':
        return this.authorizeByTask(authorizeRule);
      case 'Project':
        return this.authorizeByProject(authorizeRule);
      case 'Profile':
        return this.authorizeByProfile(authorizeRule);
      default:
        return false;
    }
  }

  /**
   * Executes authorization checks based on the provided authorization scheme.
   *
   * @param {AuthorizationScheme} authorizationScheme
   * @return {*}  {Promise<boolean>}
   * @memberof AuthorizationService
   */
  async executeAuthorizationScheme(authorizationScheme: AuthorizationScheme): Promise<boolean> {
    if ('and' in authorizationScheme) {
      const rules = authorizationScheme.and ?? [];
      for (const rule of rules) {
        const isAuthorized = await this.executeAuthorizationRule(rule);
        if (!isAuthorized) {
          return false;
        }
      }
      return true;
    }

    if ('or' in authorizationScheme) {
      const rules = authorizationScheme.or ?? [];
      for (const rule of rules) {
        const isAuthorized = await this.executeAuthorizationRule(rule);
        if (isAuthorized) {
          return true;
        }
      }
      return false;
    }

    return false;
  }

  /**
   * Checks if a user has the required roles for a task.
   *
   * @param {AuthorizeByTask} authorizeByTask - The authorization rule for the task, including taskId and valid roles.
   * @return {Promise<boolean>} - Returns true if the user has at least one valid role for the task.
   */
  private async authorizeByTask(authorizeByTask: AuthorizeByTask): Promise<boolean> {
    const task = await this.taskService.getTaskById(authorizeByTask.taskId);

    if (!task) {
      // Task does not exist
      return false;
    }

    // Fetch the role for this task profile using the profile GUID from the authenticated token
    const userRole = await this.getRoleForTaskProfile(authorizeByTask.taskId);

    if (!userRole) {
      return false; // No role found for the user-task combination
    }

    // Check if the user has the required role for the task
    if (!authorizeByTask.validTaskRoles || authorizeByTask.validTaskRoles.length === 0) {
      return true;
    }

    return this.hasRequiredRoles([userRole], authorizeByTask.validTaskRoles);
  }

  /**
   * Checks if a user has the required roles for a project.
   *
   * @param {AuthorizeByProject} authorizeByProject - The authorization rule for the project, including projectId and valid roles.
   * @return {Promise<boolean>} - Returns true if the user has at least one valid role for the project.
   */
  private async authorizeByProject(authorizeByProject: AuthorizeByProject): Promise<boolean> {
    const project = await this.projectService.getProjectById(authorizeByProject.projectId);

    if (!project) {
      // Project does not exist
      return false;
    }

    // Fetch the role for this project profile using the profile GUID from the authenticated token
    const userRole = await this.getRoleForProjectProfile(authorizeByProject.projectId);

    if (!userRole) {
      return false; // No role found for the user-project combination
    }

    // Check if the user has the required role for the project
    if (!authorizeByProject.validProjectRoles || authorizeByProject.validProjectRoles.length === 0) {
      return true;
    }

    return this.hasRequiredRoles([userRole], authorizeByProject.validProjectRoles);
  }

  /**
   * Checks if a user has the required system roles.
   *
   * @param {AuthorizeByProfile} authorizeByProfile - The authorization rule for profile roles, including valid roles.
   * @return {Promise<boolean>} - Returns true if the user has at least one valid system role.
   */
  private async authorizeByProfile(authorizeByProfile: AuthorizeByProfile): Promise<boolean> {
    const systemUserRoles = await this.getUserSystemRoles();

    const allowedSystemRoles = authorizeByProfile.validSystemRoles ?? [SYSTEM_ROLE.MEMBER];

    return this.hasRequiredRoles(systemUserRoles, allowedSystemRoles);
  }

  /**
   * Checks if a user has at least one of the required roles.
   *
   * @param {string[]} userRoles - The roles assigned to the user.
   * @param {string[]} requiredRoles - The list of roles that are required to access the resource.
   * @return {boolean} - Returns true if the user has at least one of the required roles.
   */
  private hasRequiredRoles(userRoles: string[], requiredRoles: string[]): boolean {
    return userRoles.some((role) => requiredRoles.includes(role));
  }

  /**
   * Fetches the role associated with the task for the authenticated user.
   *
   * @param {string} taskId - The ID of the task for which role is being checked.
   * @return {Promise<string | null>} - The role name if the user has a valid role, otherwise null.
   */
  private async getRoleForTaskProfile(taskId: string): Promise<string | null> {
    const profileGuid = this.getProfileGuidFromRequest();

    if (!profileGuid) {
      return null; // No GUID found in the token, return null
    }

    // Fetch the role for the user's profile and task combination
    return this.taskProfileService.getRoleForTaskProfile(taskId, profileGuid);
  }

  /**
   * Fetches the role associated with the project for the authenticated user.
   *
   * @param {string} projectId - The ID of the project for which role is being checked.
   * @return {Promise<string | null>} - The role name if the user has a valid role, otherwise null.
   */
  private async getRoleForProjectProfile(projectId: string): Promise<string | null> {
    const profileGuid = this.getProfileGuidFromRequest();

    if (!profileGuid) {
      return null; // No GUID found in the token, return null
    }

    // Fetch the role for the user's profile and project combination
    return this.projectProfileService.getRoleForProjectProfile(projectId, profileGuid);
  }

  /**
   * Fetches the system roles associated with the user.
   *
   * @return {Promise<string[]>} - A list of system roles for the user.
   */
  private async getUserSystemRoles(): Promise<string[]> {
    const profileGuid = this.getProfileGuidFromRequest();

    if (!profileGuid) {
      return []; // No GUID found in the token, return an empty array
    }

    // Fetch the profile using the GUID and return the system roles
    const profile = await this.profileService.getProfileByGuid(profileGuid);

    if (!profile) {
      return [];
    }

    return profile.role_name ? [profile.role_name] : [];
  }

  /**
   * Extract the profile GUID from the request's authenticated token.
   *
   * @return {string | null} - The profile GUID if it exists, otherwise null.
   */
  private getProfileGuidFromRequest(): string | null {
    const token = this.keycloakToken;
    return token ? getUserGuid(token) : null;
  }
}
