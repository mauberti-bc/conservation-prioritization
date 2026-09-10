import { SQL, SQLStatement } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateTaskExport, TaskExport, UpdateTaskExport } from '../models/task-export';
import { BaseRepository } from './base-repository';

const TASK_EXPORT_COLUMNS = `
  task_export_id, task_run_id, source_artifact_id, format, format_version,
  status, attempt, prefect_flow_run_id, prefect_deployment_id,
  source_checksum, specification, progress, resource_admission,
  failure_code, failure_message, started_at, completed_at, failed_at
`;

/** Repository for task export job records. */
export class TaskExportRepository extends BaseRepository {
  /**
   * Creates a queued export job.
   *
   * @param {CreateTaskExport} taskExport Export job attributes.
   * @returns {Promise<TaskExport>}
   */
  async createTaskExport(taskExport: CreateTaskExport): Promise<TaskExport> {
    const response = await this.connection.sql(
      SQL`
        INSERT INTO task_export (
          task_run_id, source_artifact_id, format, format_version,
          source_checksum, specification
        ) VALUES (
          ${taskExport.task_run_id},
          ${taskExport.source_artifact_id},
          ${taskExport.format},
          ${taskExport.format_version},
          ${taskExport.source_checksum ?? null},
          ${JSON.stringify(taskExport.specification ?? {})}::jsonb
        )
        RETURNING `.append(TASK_EXPORT_COLUMNS),
      TaskExport
    );

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create task export', ['TaskExportRepository->createTaskExport']);
    }

    return response.rows[0];
  }

  /**
   * Fetches an export job by ID.
   *
   * @param {string} taskExportId Export job ID.
   * @returns {Promise<TaskExport>}
   */
  async getTaskExportById(taskExportId: string): Promise<TaskExport> {
    const response = await this.connection.sql(
      SQL`SELECT `.append(TASK_EXPORT_COLUMNS).append(SQL`
        FROM task_export
        WHERE task_export_id = ${taskExportId}
      `),
      TaskExport
    );

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to fetch task export', ['TaskExportRepository->getTaskExportById']);
    }

    return response.rows[0];
  }

  /**
   * Locks an export job for dispatch or lifecycle transition.
   *
   * @param {string} taskExportId Export job ID.
   * @returns {Promise<TaskExport>}
   */
  async getTaskExportForUpdate(taskExportId: string): Promise<TaskExport> {
    const response = await this.connection.sql(
      SQL`SELECT `.append(TASK_EXPORT_COLUMNS).append(SQL`
        FROM task_export
        WHERE task_export_id = ${taskExportId}
        FOR UPDATE
      `),
      TaskExport
    );

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to lock task export', ['TaskExportRepository->getTaskExportForUpdate']);
    }

    return response.rows[0];
  }

  /**
   * Returns export jobs for one task run newest first.
   *
   * @param {string} taskRunId Parent task run ID.
   * @returns {Promise<TaskExport[]>}
   */
  async getTaskExportsByRunId(taskRunId: string): Promise<TaskExport[]> {
    const response = await this.connection.sql(
      SQL`SELECT `.append(TASK_EXPORT_COLUMNS).append(SQL`
        FROM task_export
        WHERE task_run_id = ${taskRunId}
        ORDER BY created_at DESC
      `),
      TaskExport
    );

    return response.rows;
  }

  /**
   * Returns export jobs for provided task runs newest first within each run.
   *
   * @param {string[]} taskRunIds Parent task run IDs.
   * @returns {Promise<TaskExport[]>}
   */
  async getTaskExportsByRunIds(taskRunIds: string[]): Promise<TaskExport[]> {
    if (!taskRunIds.length) {
      return [];
    }

    const response = await this.connection.sql(
      SQL`SELECT `.append(TASK_EXPORT_COLUMNS).append(SQL`
        FROM task_export
        WHERE task_run_id = ANY(${taskRunIds}::uuid[])
        ORDER BY task_run_id, created_at DESC
      `),
      TaskExport
    );

    return response.rows;
  }

  /**
   * Updates an export job.
   *
   * @param {string} taskExportId Export job ID.
   * @param {UpdateTaskExport} updates Job updates.
   * @returns {Promise<TaskExport>}
   */
  async updateTaskExport(taskExportId: string, updates: UpdateTaskExport): Promise<TaskExport> {
    const statement = SQL`UPDATE task_export SET updated_at = now()`;
    const fields: SQLStatement[] = [];

    if (updates.status !== undefined) {
      fields.push(SQL`status = ${updates.status}`);
    }
    if (updates.attempt !== undefined) {
      fields.push(SQL`attempt = ${updates.attempt}`);
    }
    if (updates.prefect_flow_run_id !== undefined) {
      fields.push(SQL`prefect_flow_run_id = ${updates.prefect_flow_run_id}`);
    }
    if (updates.prefect_deployment_id !== undefined) {
      fields.push(SQL`prefect_deployment_id = ${updates.prefect_deployment_id}`);
    }
    if (updates.progress !== undefined) {
      fields.push(SQL`progress = ${JSON.stringify(updates.progress)}::jsonb`);
    }
    if (updates.resource_admission !== undefined) {
      fields.push(SQL`resource_admission = ${JSON.stringify(updates.resource_admission)}::jsonb`);
    }
    if (updates.failure_code !== undefined) {
      fields.push(SQL`failure_code = ${updates.failure_code}`);
    }
    if (updates.failure_message !== undefined) {
      fields.push(SQL`failure_message = ${updates.failure_message}`);
    }

    for (const field of fields) {
      statement.append(SQL`, `).append(field);
    }

    if (updates.status === 'running') {
      statement.append(
        SQL`, started_at = COALESCE(started_at, now()), failed_at = NULL, failure_code = NULL, failure_message = NULL`
      );
    }
    if (updates.status === 'ready') {
      statement.append(SQL`, completed_at = now(), failed_at = NULL, failure_code = NULL, failure_message = NULL`);
    }
    if (updates.status === 'failed') {
      statement.append(SQL`, failed_at = now()`);
    }

    statement.append(SQL` WHERE task_export_id = ${taskExportId} RETURNING `).append(TASK_EXPORT_COLUMNS);

    const response = await this.connection.sql(statement, TaskExport);
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update task export', ['TaskExportRepository->updateTaskExport']);
    }

    return response.rows[0];
  }

  /**
   * Deletes one export job and its files.
   *
   * @param {string} taskExportId Export job ID.
   * @returns {Promise<void>}
   */
  async deleteTaskExport(taskExportId: string): Promise<void> {
    await this.connection.sql(SQL`DELETE FROM task_export WHERE task_export_id = ${taskExportId}`);
  }
}
