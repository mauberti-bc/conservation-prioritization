import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateProjectTask, DeleteProjectTask, ProjectTask } from '../models/project-task';
import { BaseRepository } from './base-repository';

/**
 * Repository for CRUD operations on project-task associations.
 *
 * @export
 * @class ProjectTaskRepository
 * @extends {BaseRepository}
 */
export class ProjectTaskRepository extends BaseRepository {
  /**
   * Create a new project-task association.
   *
   * @param {CreateProjectTask} projectTask
   * @return {*}  {Promise<ProjectTask>}
   * @memberof ProjectTaskRepository
   */
  async createProjectTask(projectTask: CreateProjectTask): Promise<ProjectTask> {
    const sqlStatement = SQL`
      INSERT INTO project_task (project_id, task_id)
      VALUES (${projectTask.project_id}, ${projectTask.task_id})
      RETURNING project_task_id, project_id, task_id
    `;

    const response = await this.connection.sql(sqlStatement, ProjectTask);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create project-task association', [
        'ProjectTaskRepository->createProjectTask',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Create multiple project-task associations.
   *
   * @param {string} projectId
   * @param {string[]} taskIds
   * @return {*}  {Promise<ProjectTask[]>}
   * @memberof ProjectTaskRepository
   */
  async createProjectTasks(projectId: string, taskIds: string[]): Promise<ProjectTask[]> {
    if (!taskIds.length) {
      return [];
    }

    const sqlStatement = SQL`
      INSERT INTO project_task (project_id, task_id)
      SELECT ${projectId}::uuid, unnest(${taskIds}::uuid[])
      ON CONFLICT (project_id, task_id) DO NOTHING
      RETURNING project_task_id, project_id, task_id
    `;

    const response = await this.connection.sql(sqlStatement, ProjectTask);

    return response?.rows || [];
  }

  /**
   * Fetch a project-task association by its ID.
   *
   * @param {string} projectTaskId
   * @return {*}  {Promise<ProjectTask>}
   * @memberof ProjectTaskRepository
   */
  async getProjectTaskById(projectTaskId: string): Promise<ProjectTask> {
    const sqlStatement = SQL`
      SELECT project_task_id, project_id, task_id
      FROM project_task
      WHERE project_task_id = ${projectTaskId}
    `;

    const response = await this.connection.sql(sqlStatement, ProjectTask);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to fetch project-task association', [
        'ProjectTaskRepository->getProjectTaskById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch all project-task associations for a given project ID.
   *
   * @param {string} projectId
   * @return {*}  {Promise<ProjectTask[]>}
   * @memberof ProjectTaskRepository
   */
  async getProjectTasksByProjectId(projectId: string): Promise<ProjectTask[]> {
    const sqlStatement = SQL`
      SELECT project_task_id, project_id, task_id
      FROM project_task
      WHERE project_id = ${projectId}
    `;

    const response = await this.connection.sql(sqlStatement, ProjectTask);

    return response.rows;
  }

  /**
   * Delete a project-task association.
   *
   * @param {DeleteProjectTask} data
   * @return {*}  {Promise<void>}
   * @memberof ProjectTaskRepository
   */
  async deleteProjectTask(data: DeleteProjectTask): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM project_task
      WHERE project_task_id = ${data.project_task_id}
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete project-task association', [
        'ProjectTaskRepository->deleteProjectTask',
        'Expected rowCount = 1'
      ]);
    }
  }
}
