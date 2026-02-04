import { IDBConnection } from '../database/db';
import {
  AuthorizeByProject,
  AuthorizeBySystemRole,
  AuthorizeByTask,
  AuthorizeRule
} from './authorization-service.interface';
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

  constructor(connection: IDBConnection) {
    super(connection);
    this.profileService = new ProfileService(connection);
    this.taskService = new TaskService(connection);
    this.taskProfileService = new TaskProfileService(connection);
    this.projectService = new ProjectService(connection);
    this.projectProfileService = new ProjectProfileService(connection);
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
      case 'SystemRole':
        return this.authorizeBySystemRole(authorizeRule);
      default:
        return false;
    }
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
    return this.hasRequiredRoles([userRole], authorizeByProject.validProjectRoles);
  }

  /**
   * Checks if a user has the required system roles.
   *
   * @param {AuthorizeBySystemRole} authorizeBySystemRole - The authorization rule for the system roles, including valid roles.
   * @return {Promise<boolean>} - Returns true if the user has at least one valid system role.
   */
  private async authorizeBySystemRole(authorizeBySystemRole: AuthorizeBySystemRole): Promise<boolean> {
    const systemUserRoles = await this.getUserSystemRoles();

    return this.hasRequiredRoles(systemUserRoles, authorizeBySystemRole.validSystemRoles);
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

    return profile.role_name ? [profile.role_name] : [];
  }

  /**
   * Extract the profile GUID from the request's authenticated token.
   *
   * @return {string | null} - The profile GUID if it exists, otherwise null.
   */
  private getProfileGuidFromRequest(): string | null {
    const token = (this as any).req.keycloak_token; // Assuming `req.keycloak_token` is set in your request object

    if (token && token.profile_guid) {
      return token.profile_guid; // Extract the profile GUID from the token
    }

    return null; // Return null if the profile GUID is not found
  }
}
