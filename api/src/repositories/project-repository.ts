import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateProject, DeleteProject, Project, UpdateProject } from '../models/project';
import { BaseRepository } from './base-repository';

/**
 * Repository for project table CRUD operations.
 *
 * @export
 * @class ProjectRepository
 * @extends {BaseRepository}
 */
export class ProjectRepository extends BaseRepository {
  /**
   * Creates a new project record.
   *
   * @param {CreateProject} project
   *   The project data to insert.
   *
   * @return {*}  {Promise<Project>}
   *   The newly created project.
   *
   * @memberof ProjectRepository
   */
  async createProject(project: CreateProject): Promise<Project> {
    const sqlStatement = SQL`
      INSERT INTO project (
        name,
        description
      ) VALUES (
        ${project.name},
        ${project.description ?? null}
      )
      RETURNING project_id, name, description
    `;

    const response = await this.connection.sql(sqlStatement, Project);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create project', [
        'ProjectRepository->createProject',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches a single active project by its project ID.
   *
   * @param {string} projectId
   *   The UUID of the project.
   *
   * @return {*}  {Promise<Project>}
   *   The matching project.
   *
   * @memberof ProjectRepository
   */
  async getProjectById(projectId: string): Promise<Project> {
    const sqlStatement = SQL`
      SELECT
        project_id, name, description
      FROM
        project
      WHERE
        project_id = ${projectId}
      AND
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, Project);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get project by id', [
        'ProjectRepository->getProjectById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches all active projects.
   *
   * @return {*}  {Promise<Project[]>}
   *   A list of active projects.
   *
   * @memberof ProjectRepository
   */
  async getProjects(): Promise<Project[]> {
    const sqlStatement = SQL`
      SELECT
        project_id, name, description
      FROM
        project
      WHERE
        record_end_date IS NULL
      ORDER BY
        name
    `;

    const response = await this.connection.sql(sqlStatement, Project);

    return response.rows;
  }

  /**
   * Updates an existing active project.
   *
   * Only supplied fields will be updated; all others remain unchanged.
   * Audit fields are managed by database triggers.
   *
   * @param {string} projectId
   *   The UUID of the project to update.
   *
   * @param {UpdateProject} updates
   *   The project fields to update.
   *
   * @return {*}  {Promise<Project>}
   *   The updated project.
   *
   * @memberof ProjectRepository
   */
  async updateProject(projectId: string, updates: UpdateProject): Promise<Project> {
    const sqlStatement = SQL`
      UPDATE project
      SET
        name = COALESCE(${updates.name}, name),
        description = COALESCE(${updates.description}, description)
      WHERE
        project_id = ${projectId}
      AND
        record_end_date IS NULL
      RETURNING project_id, name, description
    `;

    const response = await this.connection.sql(sqlStatement, Project);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update project', [
        'ProjectRepository->updateProject',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft deletes an active project by setting its record end date.
   *
   * @param {DeleteProject} data
   *   The project identifier.
   *
   * @return {*}  {Promise<void>}
   *
   * @memberof ProjectRepository
   */
  async deleteProject(data: DeleteProject): Promise<void> {
    const sqlStatement = SQL`
      UPDATE project
      SET
        record_end_date = now()
      WHERE
        project_id = ${data.project_id}
      AND
        record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete project', [
        'ProjectRepository->deleteProject',
        'Expected rowCount = 1'
      ]);
    }
  }
}
