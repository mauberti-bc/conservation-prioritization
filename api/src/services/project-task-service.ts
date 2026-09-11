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
   * @param {IDBConnection} connection Database connection used for queries and transaction context.
   * @memberof ProjectTaskService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.projectTaskRepository = new ProjectTaskRepository(connection);
  }

  /**
   * Create a new project-task association.
   *
   * @param {CreateProjectTask} projectTask Project-to-task association to persist.
   * @returns {Promise<ProjectTask>} The project task record.
   * @memberof ProjectTaskService
   */
  async createProjectTask(projectTask: CreateProjectTask): Promise<ProjectTask> {
    return this.projectTaskRepository.createProjectTask(projectTask);
  }

  /**
   * Get a project-task association by ID.
   *
   * @param {string} projectTaskId Identifier of the project-to-task association.
   * @returns {Promise<ProjectTask>} The project task record.
   * @memberof ProjectTaskService
   */
  async getProjectTaskById(projectTaskId: string): Promise<ProjectTask> {
    return this.projectTaskRepository.getProjectTaskById(projectTaskId);
  }

  /**
   * Get all project-task associations for a given project ID.
   *
   * @param {string} projectId Identifier of the project.
   * @returns {Promise<ProjectTask[]>} Matching project task records.
   * @memberof ProjectTaskService
   */
  async getProjectTasksByProjectId(projectId: string): Promise<ProjectTask[]> {
    return this.projectTaskRepository.getProjectTasksByProjectId(projectId);
  }

  /**
   * Delete a project-task association.
   *
   * @param {DeleteProjectTask} data Data to persist or process.
   * @returns {Promise<void>} Resolves when the operation completes.
   * @memberof ProjectTaskService
   */
  async deleteProjectTask(data: DeleteProjectTask): Promise<void> {
    return this.projectTaskRepository.deleteProjectTask(data);
  }

  /**
   * Add one or more tasks to a project.
   *
   * @param {string} projectId Identifier of the project.
   * @param {string[]} taskIds Identifiers of the tasks to process.
   * @returns {Promise<ProjectTask[]>} The created project-to-task associations.
   * @memberof ProjectTaskService
   */
  async addTasksToProject(projectId: string, taskIds: string[]): Promise<ProjectTask[]> {
    return this.projectTaskRepository.createProjectTasks(projectId, taskIds);
  }

  /**
   * Adds one or more projects to a task.
   *
   * @param {string} taskId Identifier of the task.
   * @param {string[]} projectIds Identifiers of the projects.
   * @returns {Promise<ProjectTask[]>} The created task-to-project associations.
   * @memberof ProjectTaskService
   */
  async addProjectsToTask(taskId: string, projectIds: string[]): Promise<ProjectTask[]> {
    return this.projectTaskRepository.createTaskProjects(taskId, projectIds);
  }
}
