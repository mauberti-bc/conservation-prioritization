import { IDBConnection } from '../database/db';
import { CreateTaskExportFile, TaskExportFile, UpdateTaskExportFile } from '../models/task-export-file';
import { TaskExportFileRepository } from '../repositories/task-export-file-repository';
import { DBService } from './db-service';

/**
 * Service for managing task export file metadata.
 */
export class TaskExportFileService extends DBService {
  private taskExportFileRepository: TaskExportFileRepository;

  /**
   * Creates a TaskExportFileService.
   *
   * @param {IDBConnection} connection Database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.taskExportFileRepository = new TaskExportFileRepository(connection);
  }

  /**
   * Creates or replaces one deterministic export file record.
   *
   * @param {CreateTaskExportFile} file Durable file metadata.
   * @returns {Promise<TaskExportFile>} The task export file record.
   */
  async createTaskExportFile(file: CreateTaskExportFile): Promise<TaskExportFile> {
    return this.taskExportFileRepository.createTaskExportFile(file);
  }

  /**
   * Returns one export file by ID.
   *
   * @param {string} taskExportFileId Export file ID.
   * @returns {Promise<TaskExportFile>} One export file by ID.
   */
  async getTaskExportFileById(taskExportFileId: string): Promise<TaskExportFile> {
    return this.taskExportFileRepository.getTaskExportFileById(taskExportFileId);
  }

  /**
   * Returns export files for one parent export.
   *
   * @param {string} taskExportId Parent export ID.
   * @returns {Promise<TaskExportFile[]>} Export files for one parent export.
   */
  async getTaskExportFilesByExportId(taskExportId: string): Promise<TaskExportFile[]> {
    return this.taskExportFileRepository.getTaskExportFilesByExportId(taskExportId);
  }

  /**
   * Updates one export file record.
   *
   * @param {string} taskExportFileId Export file ID.
   * @param {UpdateTaskExportFile} updates File metadata updates.
   * @returns {Promise<TaskExportFile>} The task export file record.
   */
  async updateTaskExportFile(taskExportFileId: string, updates: UpdateTaskExportFile): Promise<TaskExportFile> {
    return this.taskExportFileRepository.updateTaskExportFile(taskExportFileId, updates);
  }

  /**
   * Deletes one export file record.
   *
   * @param {string} taskExportFileId Export file ID.
   * @returns {Promise<void>} Resolves when the operation completes.
   */
  async deleteTaskExportFile(taskExportFileId: string): Promise<void> {
    await this.taskExportFileRepository.deleteTaskExportFile(taskExportFileId);
  }
}
