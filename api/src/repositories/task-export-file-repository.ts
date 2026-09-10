import { SQL, SQLStatement } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateTaskExportFile, TaskExportFile, UpdateTaskExportFile } from '../models/task-export-file';
import { BaseRepository } from './base-repository';

const TASK_EXPORT_FILE_COLUMNS = `
  task_export_file_id, task_export_id, part_index, filename, object_key,
  content_type, byte_size, checksum, row_offset, column_offset, width, height,
  transform, metadata
`;

/** Repository for durable task export file records. */
export class TaskExportFileRepository extends BaseRepository {
  /**
   * Creates one export file record.
   *
   * @param {CreateTaskExportFile} file Export file attributes.
   * @returns {Promise<TaskExportFile>}
   */
  async createTaskExportFile(file: CreateTaskExportFile): Promise<TaskExportFile> {
    const response = await this.connection.sql(
      SQL`
        INSERT INTO task_export_file (
          task_export_id, part_index, filename, object_key, content_type,
          byte_size, checksum, row_offset, column_offset, width, height,
          transform, metadata
        ) VALUES (
          ${file.task_export_id},
          ${file.part_index},
          ${file.filename},
          ${file.object_key},
          ${file.content_type ?? 'image/tiff'},
          ${file.byte_size},
          ${file.checksum},
          ${file.row_offset},
          ${file.column_offset},
          ${file.width},
          ${file.height},
          ${JSON.stringify(file.transform)}::jsonb,
          ${JSON.stringify(file.metadata ?? {})}::jsonb
        )
        ON CONFLICT (task_export_id, part_index) DO UPDATE SET
          filename = EXCLUDED.filename,
          object_key = EXCLUDED.object_key,
          content_type = EXCLUDED.content_type,
          byte_size = EXCLUDED.byte_size,
          checksum = EXCLUDED.checksum,
          row_offset = EXCLUDED.row_offset,
          column_offset = EXCLUDED.column_offset,
          width = EXCLUDED.width,
          height = EXCLUDED.height,
          transform = EXCLUDED.transform,
          metadata = EXCLUDED.metadata,
          updated_at = now()
        RETURNING `.append(TASK_EXPORT_FILE_COLUMNS),
      TaskExportFile
    );

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create task export file', [
        'TaskExportFileRepository->createTaskExportFile'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches one export file by ID.
   *
   * @param {string} taskExportFileId Export file ID.
   * @returns {Promise<TaskExportFile>}
   */
  async getTaskExportFileById(taskExportFileId: string): Promise<TaskExportFile> {
    const response = await this.connection.sql(
      SQL`SELECT `.append(TASK_EXPORT_FILE_COLUMNS).append(SQL`
        FROM task_export_file
        WHERE task_export_file_id = ${taskExportFileId}
      `),
      TaskExportFile
    );

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to fetch task export file', [
        'TaskExportFileRepository->getTaskExportFileById'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Returns all files for an export ordered by deterministic part index.
   *
   * @param {string} taskExportId Parent export ID.
   * @returns {Promise<TaskExportFile[]>}
   */
  async getTaskExportFilesByExportId(taskExportId: string): Promise<TaskExportFile[]> {
    const response = await this.connection.sql(
      SQL`SELECT `.append(TASK_EXPORT_FILE_COLUMNS).append(SQL`
        FROM task_export_file
        WHERE task_export_id = ${taskExportId}
        ORDER BY part_index
      `),
      TaskExportFile
    );

    return response.rows;
  }

  /**
   * Updates one export file record.
   *
   * @param {string} taskExportFileId Export file ID.
   * @param {UpdateTaskExportFile} updates File metadata updates.
   * @returns {Promise<TaskExportFile>}
   */
  async updateTaskExportFile(taskExportFileId: string, updates: UpdateTaskExportFile): Promise<TaskExportFile> {
    const statement = SQL`UPDATE task_export_file SET updated_at = now()`;
    const fields: SQLStatement[] = [];

    if (updates.filename !== undefined) {
      fields.push(SQL`filename = ${updates.filename}`);
    }
    if (updates.object_key !== undefined) {
      fields.push(SQL`object_key = ${updates.object_key}`);
    }
    if (updates.content_type !== undefined) {
      fields.push(SQL`content_type = ${updates.content_type}`);
    }
    if (updates.byte_size !== undefined) {
      fields.push(SQL`byte_size = ${updates.byte_size}`);
    }
    if (updates.checksum !== undefined) {
      fields.push(SQL`checksum = ${updates.checksum}`);
    }
    if (updates.row_offset !== undefined) {
      fields.push(SQL`row_offset = ${updates.row_offset}`);
    }
    if (updates.column_offset !== undefined) {
      fields.push(SQL`column_offset = ${updates.column_offset}`);
    }
    if (updates.width !== undefined) {
      fields.push(SQL`width = ${updates.width}`);
    }
    if (updates.height !== undefined) {
      fields.push(SQL`height = ${updates.height}`);
    }
    if (updates.transform !== undefined) {
      fields.push(SQL`transform = ${JSON.stringify(updates.transform)}::jsonb`);
    }
    if (updates.metadata !== undefined) {
      fields.push(SQL`metadata = ${JSON.stringify(updates.metadata)}::jsonb`);
    }

    if (!fields.length) {
      throw new ApiExecuteSQLError('No task export file updates provided', [
        'TaskExportFileRepository->updateTaskExportFile'
      ]);
    }

    for (const field of fields) {
      statement.append(SQL`, `).append(field);
    }

    statement.append(SQL` WHERE task_export_file_id = ${taskExportFileId} RETURNING `).append(TASK_EXPORT_FILE_COLUMNS);

    const response = await this.connection.sql(statement, TaskExportFile);
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update task export file', [
        'TaskExportFileRepository->updateTaskExportFile'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Deletes one export file record.
   *
   * @param {string} taskExportFileId Export file ID.
   * @returns {Promise<void>}
   */
  async deleteTaskExportFile(taskExportFileId: string): Promise<void> {
    await this.connection.sql(SQL`DELETE FROM task_export_file WHERE task_export_file_id = ${taskExportFileId}`);
  }
}
