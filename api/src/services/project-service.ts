import { IDBConnection } from '../database/db';
import { CreateProject, DeleteProject, Project, UpdateProject } from '../models/project';
import { ProjectRepository } from '../repositories/project-repository';
import { DBService } from './db-service';

/**
 * Service for reading/writing project data.
 *
 * @export
 * @class ProjectService
 * @extends {DBService}
 */
export class ProjectService extends DBService {
  projectRepository: ProjectRepository;

  /**
   * Creates an instance of ProjectService.
   *
   * @param {IDBConnection} connection
   * @memberof ProjectService
   */
  constructor(connection: IDBConnection) {
    super(connection);

    this.projectRepository = new ProjectRepository(connection);
  }

  /**
   * Create a new project.
   *
   * @param {CreateProject} project
   * @return {*}  {Promise<Project>}
   * @memberof ProjectService
   */
  async createProject(project: CreateProject): Promise<Project> {
    return this.projectRepository.createProject(project);
  }

  /**
   * Get a project by project ID.
   *
   * @param {string} projectId
   * @return {*}  {Promise<Project>}
   * @memberof ProjectService
   */
  async getProjectById(projectId: string): Promise<Project> {
    return this.projectRepository.getProjectById(projectId);
  }

  /**
   * Get all active projects.
   *
   * @return {*}  {Promise<Project[]>}
   * @memberof ProjectService
   */
  async getProjects(): Promise<Project[]> {
    return this.projectRepository.getProjects();
  }

  /**
   * Get all active projects available to a specific profile GUID.
   *
   * @param {string} profileGuid
   * @return {*}  {Promise<Project[]>}
   * @memberof ProjectService
   */
  async getProjectsForProfileGuid(profileGuid: string): Promise<Project[]> {
    return this.projectRepository.getProjectsByProfileGuid(profileGuid);
  }

  /**
   * Update an existing project.
   *
   * @param {string} projectId
   * @param {UpdateProject} updates
   * @return {*}  {Promise<Project>}
   * @memberof ProjectService
   */
  async updateProject(projectId: string, updates: UpdateProject): Promise<Project> {
    return this.projectRepository.updateProject(projectId, updates);
  }

  /**
   * Soft delete a project.
   *
   * @param {DeleteProject} data
   * @return {*}  {Promise<void>}
   * @memberof ProjectService
   */
  async deleteProject(data: DeleteProject): Promise<void> {
    return this.projectRepository.deleteProject(data);
  }
}
