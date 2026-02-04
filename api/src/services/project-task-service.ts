import { IDBConnection } from '../database/db';
import { CreateProjectTask, DeleteProjectTask, ProjectTask } from '../models/project-task';
import { ProjectTaskRepository } from '../repositories/project-task-repository';
import { DBService } from './db-service';

/**
 * Service for managing project-task associations.
 *
 * @export
 * @class ProjectTaskService
 * @extends {DBService}
 */
export class ProjectTaskService extends DBService {
  projectTaskRepository: ProjectTaskRepository;

  /**
   * Creates an instance of ProjectTaskService.
   *
   * @param {IDBConnection} connection
   * @memberof ProjectTaskService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.projectTaskRepository = new ProjectTaskRepository(connection);
  }

  /**
   * Create a new project-task association.
   *
   * @param {CreateProjectTask} projectTask
   * @return {*}  {Promise<ProjectTask>}
   * @memberof ProjectTaskService
   */
  async createProjectTask(projectTask: CreateProjectTask): Promise<ProjectTask> {
    return this.projectTaskRepository.createProjectTask(projectTask);
  }

  /**
   * Get a project-task association by ID.
   *
   * @param {string} projectTaskId
   * @return {*}  {Promise<ProjectTask>}
   * @memberof ProjectTaskService
   */
  async getProjectTaskById(projectTaskId: string): Promise<ProjectTask> {
    return this.projectTaskRepository.getProjectTaskById(projectTaskId);
  }

  /**
   * Get all project-task associations for a given project ID.
   *
   * @param {string} projectId
   * @return {*}  {Promise<ProjectTask[]>}
   * @memberof ProjectTaskService
   */
  async getProjectTasksByProjectId(projectId: string): Promise<ProjectTask[]> {
    return this.projectTaskRepository.getProjectTasksByProjectId(projectId);
  }

  /**
   * Delete a project-task association.
   *
   * @param {DeleteProjectTask} data
   * @return {*}  {Promise<void>}
   * @memberof ProjectTaskService
   */
  async deleteProjectTask(data: DeleteProjectTask): Promise<void> {
    return this.projectTaskRepository.deleteProjectTask(data);
  }
}
