import { IDBConnection } from '../database/db';
import {
  CreateProjectPermission,
  DeleteProjectPermission,
  ProjectPermission,
  UpdateProjectPermission
} from '../models/project-permission';
import { ProjectPermissionRepository } from '../repositories/project-permission-repository';
import { DBService } from './db-service';

/**
 * Service for managing project permissions.
 *
 * @export
 * @class ProjectPermissionService
 * @extends {DBService}
 */
export class ProjectPermissionService extends DBService {
  projectPermissionRepository: ProjectPermissionRepository;

  /**
   * Creates an instance of ProjectPermissionService.
   *
   * @param {IDBConnection} connection - The database connection to use.
   * @memberof ProjectPermissionService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.projectPermissionRepository = new ProjectPermissionRepository(connection);
  }

  /**
   * Creates a new project permission.
   *
   * @param {CreateProjectPermission} projectPermission - The project permission data to insert.
   * @return {*}  {Promise<ProjectPermission>} The newly created project permission.
   * @memberof ProjectPermissionService
   */
  async createProjectPermission(projectPermission: CreateProjectPermission): Promise<ProjectPermission> {
    return this.projectPermissionRepository.createProjectPermission(projectPermission);
  }

  /**
   * Fetches a project permission by its ID.
   *
   * @param {string} projectPermissionId - The UUID of the project permission.
   * @return {*}  {Promise<ProjectPermission>} The matching project permission.
   * @memberof ProjectPermissionService
   */
  async getProjectPermissionById(projectPermissionId: string): Promise<ProjectPermission> {
    return this.projectPermissionRepository.getProjectPermissionById(projectPermissionId);
  }

  /**
   * Fetches all active project permissions.
   *
   * @return {*}  {Promise<ProjectPermission[]>} List of active project permissions.
   * @memberof ProjectPermissionService
   */
  async getProjectPermissions(): Promise<ProjectPermission[]> {
    return this.projectPermissionRepository.getProjectPermissions();
  }

  /**
   * Updates an existing project permission.
   *
   * @param {string} projectPermissionId - The UUID of the project permission to update.
   * @param {UpdateProjectPermission} updates - The fields to update.
   * @return {*}  {Promise<ProjectPermission>} The updated project permission.
   * @memberof ProjectPermissionService
   */
  async updateProjectPermission(
    projectPermissionId: string,
    updates: UpdateProjectPermission
  ): Promise<ProjectPermission> {
    return this.projectPermissionRepository.updateProjectPermission(projectPermissionId, updates);
  }

  /**
   * Soft deletes a project permission by setting its record end date.
   *
   * @param {DeleteProjectPermission} data - The data containing the project_permission_id to delete.
   * @return {*}  {Promise<void>} Resolves when the deletion is successful.
   * @memberof ProjectPermissionService
   */
  async deleteProjectPermission(data: DeleteProjectPermission): Promise<void> {
    return this.projectPermissionRepository.deleteProjectPermission(data);
  }
}
