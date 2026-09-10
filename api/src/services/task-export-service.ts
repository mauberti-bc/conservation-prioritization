import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import { Artifact } from '../models/artifact';
import { CreateTaskExport, TaskExport, TaskExportFormat, UpdateTaskExport } from '../models/task-export';
import { CreateTaskExportFile, TaskExportFile } from '../models/task-export-file';
import { TaskExportDownload, TaskExportWithFiles } from '../models/task-export.interface';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { TaskExportFileRepository } from '../repositories/task-export-file-repository';
import { TaskExportRepository } from '../repositories/task-export-repository';
import { TaskRunRepository } from '../repositories/task-run-repository';
import { getObjectStoreConfig, getPresignedObjectUrl } from '../utils/object-store';
import { DBService } from './db-service';
import { PrefectService } from './prefect-service';

const TASK_EXPORT_FORMAT_VERSIONS: Record<TaskExportFormat, string> = {
  geotiff: 'geotiff-v1',
  geodatabase: 'geodatabase-v1'
};
const DOWNLOAD_URL_EXPIRY_SECONDS = 300;

/** Coordinates task-run export jobs and durable file metadata. */
export class TaskExportService extends DBService {
  private taskExportRepository: TaskExportRepository;
  private taskExportFileRepository: TaskExportFileRepository;
  private taskRunRepository: TaskRunRepository;
  private artifactRepository: ArtifactRepository;

  /**
   * Creates a TaskExportService.
   *
   * @param {IDBConnection} connection Database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.taskExportRepository = new TaskExportRepository(connection);
    this.taskExportFileRepository = new TaskExportFileRepository(connection);
    this.taskRunRepository = new TaskRunRepository(connection);
    this.artifactRepository = new ArtifactRepository(connection);
  }

  /**
   * Creates a queued export to be committed before dispatching its Prefect flow.
   *
   * @param {string} taskRunId Immutable parent task run ID.
   * @param {TaskExportFormat} format Requested output format.
   * @returns {Promise<TaskExportWithFiles>} Queued export awaiting commit and dispatch.
   * @throws {HTTP400} When the format is unsupported or the run has no completed canonical result.
   */
  async createQueuedExport(taskRunId: string, format: TaskExportFormat = 'geotiff'): Promise<TaskExportWithFiles> {
    if (format === 'geodatabase') {
      throw new HTTP400('ESRI geodatabase exports are not implemented yet.');
    }

    const run = await this.taskRunRepository.getTaskRunById(taskRunId);
    if (run.status !== 'completed') {
      throw new HTTP400('Only completed task runs can be exported.');
    }

    const sourceArtifact = await this.getReadyCanonicalArtifact(taskRunId);
    const taskExport = await this.taskExportRepository.createTaskExport({
      task_run_id: taskRunId,
      source_artifact_id: sourceArtifact.artifact_id,
      format,
      format_version: TASK_EXPORT_FORMAT_VERSIONS[format],
      source_checksum: sourceArtifact.checksum,
      specification: this.buildExportSpecification(run.task_type, sourceArtifact, format)
    });

    return this.withFiles(taskExport);
  }

  /**
   * Dispatches a previously committed queued export using its stable Prefect idempotency key.
   *
   * @param {string} taskExportId Persisted export ID to dispatch.
   * @returns {Promise<TaskExportWithFiles>} Export with dispatch metadata, or its existing execution state.
   * @throws {Error} When dispatch fails; the caller must commit the recorded failure before propagating it.
   */
  async dispatchQueuedExport(taskExportId: string): Promise<TaskExportWithFiles> {
    const taskExport = await this.taskExportRepository.getTaskExportForUpdate(taskExportId);
    if (taskExport.prefect_flow_run_id || taskExport.status !== 'queued') {
      return this.withFiles(taskExport);
    }

    let deploymentId: string;
    let flowRunId: string;
    try {
      ({ deploymentId, flowRunId } = await new PrefectService().submitTaskExport(
        taskExport.task_export_id,
        taskExport.attempt
      ));
    } catch (error) {
      await this.taskExportRepository.updateTaskExport(taskExport.task_export_id, {
        status: 'failed',
        failure_code: 'dispatch_failed',
        failure_message: error instanceof Error ? error.message : 'Failed to dispatch export.'
      });
      throw error;
    }

    const updated = await this.taskExportRepository.updateTaskExport(taskExport.task_export_id, {
      prefect_flow_run_id: flowRunId,
      prefect_deployment_id: deploymentId
    });
    return this.withFiles(updated);
  }

  /**
   * Creates an export job record without dispatching Prefect.
   *
   * @param {CreateTaskExport} taskExport Export attributes.
   * @returns {Promise<TaskExport>}
   */
  async createTaskExport(taskExport: CreateTaskExport): Promise<TaskExport> {
    return this.taskExportRepository.createTaskExport(taskExport);
  }

  /**
   * Returns one export with its files.
   *
   * @param {string} taskExportId Export ID.
   * @returns {Promise<TaskExportWithFiles>}
   */
  async getTaskExportById(taskExportId: string): Promise<TaskExportWithFiles> {
    return this.withFiles(await this.taskExportRepository.getTaskExportById(taskExportId));
  }

  /**
   * Returns one export after verifying its parent run.
   *
   * @param {string} taskRunId Parent task run ID.
   * @param {string} taskExportId Export ID.
   * @returns {Promise<TaskExportWithFiles>}
   */
  async getTaskExportByRunId(taskRunId: string, taskExportId: string): Promise<TaskExportWithFiles> {
    const taskExport = await this.taskExportRepository.getTaskExportById(taskExportId);
    if (taskExport.task_run_id !== taskRunId) {
      throw new HTTP400('Export does not belong to the requested run.');
    }
    return this.withFiles(taskExport);
  }

  /**
   * Returns all exports for one run.
   *
   * @param {string} taskRunId Parent task run ID.
   * @returns {Promise<TaskExportWithFiles[]>}
   */
  async getTaskExportsByRunId(taskRunId: string): Promise<TaskExportWithFiles[]> {
    const exports = await this.taskExportRepository.getTaskExportsByRunId(taskRunId);
    return Promise.all(exports.map(async (taskExport) => this.withFiles(taskExport)));
  }

  /**
   * Updates one export job record.
   *
   * @param {string} taskExportId Export ID.
   * @param {UpdateTaskExport} updates Export updates.
   * @returns {Promise<TaskExport>}
   */
  async updateTaskExport(taskExportId: string, updates: UpdateTaskExport): Promise<TaskExport> {
    return this.taskExportRepository.updateTaskExport(taskExportId, updates);
  }

  /**
   * Deletes one export and its file records.
   *
   * @param {string} taskExportId Export ID.
   * @returns {Promise<void>}
   */
  async deleteTaskExport(taskExportId: string): Promise<void> {
    await this.taskExportRepository.deleteTaskExport(taskExportId);
  }

  /**
   * Applies a worker lifecycle update after checking the execution attempt.
   *
   * @param {string} taskExportId Export ID.
   * @param {number} attempt Worker execution generation.
   * @param {UpdateTaskExport} updates Export lifecycle updates.
   * @returns {Promise<TaskExport>}
   */
  async updateExportFromWorker(taskExportId: string, attempt: number, updates: UpdateTaskExport): Promise<TaskExport> {
    const current = await this.taskExportRepository.getTaskExportForUpdate(taskExportId);
    if (current.attempt !== attempt) {
      throw new ApiGeneralError('Ignoring stale export callback for a previous attempt.', []);
    }

    const allowedStatuses: Record<TaskExport['status'], TaskExport['status'][]> = {
      queued: ['queued', 'running', 'failed'],
      running: ['running', 'ready', 'failed'],
      ready: ['ready'],
      failed: ['failed', 'running']
    };

    if (updates.status && !allowedStatuses[current.status].includes(updates.status)) {
      throw new ApiGeneralError(`Invalid export status transition from ${current.status} to ${updates.status}.`, []);
    }

    if (updates.status === 'ready') {
      const files = await this.taskExportFileRepository.getTaskExportFilesByExportId(taskExportId);
      if (!files.length) {
        throw new ApiGeneralError('An export cannot be ready before at least one file is recorded.', []);
      }
    }

    return this.taskExportRepository.updateTaskExport(taskExportId, updates);
  }

  /**
   * Creates or updates a durable file record from a worker callback.
   *
   * @param {string} taskExportId Parent export ID.
   * @param {number} attempt Worker execution generation.
   * @param {CreateTaskExportFile} file Durable file metadata.
   * @returns {Promise<TaskExportFile>}
   */
  async createExportFileFromWorker(
    taskExportId: string,
    attempt: number,
    file: CreateTaskExportFile
  ): Promise<TaskExportFile> {
    const taskExport = await this.taskExportRepository.getTaskExportForUpdate(taskExportId);
    if (taskExport.attempt !== attempt) {
      throw new ApiGeneralError('Ignoring stale export file callback for a previous attempt.', []);
    }
    if (taskExport.status !== 'running') {
      throw new ApiGeneralError('Export files can only be recorded while an export is running.', []);
    }
    if (file.task_export_id !== taskExportId) {
      throw new ApiGeneralError('Export file parent does not match request path.', []);
    }

    return this.taskExportFileRepository.createTaskExportFile(file);
  }

  /**
   * Generates a short-lived download URL for a persisted export file.
   *
   * @param {string} taskRunId Parent task run ID from the request path.
   * @param {string} taskExportId Parent export ID from the request path.
   * @param {string} taskExportFileId Export file ID to sign.
   * @returns {Promise<TaskExportDownload>}
   */
  async getDownloadUrl(taskRunId: string, taskExportId: string, taskExportFileId: string): Promise<TaskExportDownload> {
    const taskExport = await this.taskExportRepository.getTaskExportById(taskExportId);
    if (taskExport.task_run_id !== taskRunId) {
      throw new HTTP400('Export does not belong to the requested run.');
    }
    if (taskExport.status !== 'ready') {
      throw new HTTP400('Export files are available only after the export is ready.');
    }

    const file = await this.taskExportFileRepository.getTaskExportFileById(taskExportFileId);
    if (file.task_export_id !== taskExportId) {
      throw new HTTP400('Export file does not belong to the requested export.');
    }

    const config = getObjectStoreConfig();
    const url = await getPresignedObjectUrl(config.bucket, file.object_key, DOWNLOAD_URL_EXPIRY_SECONDS);
    if (!url) {
      throw new ApiGeneralError('Failed to create export file download URL.', []);
    }

    return {
      url,
      expires_in_seconds: DOWNLOAD_URL_EXPIRY_SECONDS
    };
  }

  private async getReadyCanonicalArtifact(taskRunId: string): Promise<Artifact> {
    const artifact = await this.artifactRepository.getArtifactByRunAndType(taskRunId, 'canonical_result');
    if (artifact.status !== 'ready' || !artifact.uri || !artifact.manifest) {
      throw new HTTP400('A ready canonical result is required before export.');
    }
    return artifact;
  }

  private async withFiles(taskExport: TaskExport): Promise<TaskExportWithFiles> {
    return {
      ...taskExport,
      files: await this.taskExportFileRepository.getTaskExportFilesByExportId(taskExport.task_export_id)
    };
  }

  private buildExportSpecification(
    taskType: string,
    sourceArtifact: Artifact,
    format: TaskExportFormat
  ): Record<string, unknown> {
    const surfaceByTaskType: Record<string, string> = {
      discrete_optimization: 'decision',
      continuous_optimization: 'allocation',
      priority_ranking: 'priority'
    };

    return {
      schema_version: 1,
      format,
      format_version: TASK_EXPORT_FORMAT_VERSIONS[format],
      source_artifact_type: sourceArtifact.type,
      source_artifact_uri: sourceArtifact.uri,
      surface: surfaceByTaskType[taskType] ?? 'decision',
      part_size_pixels: 4096,
      block_size_pixels: 512,
      compression: 'DEFLATE'
    };
  }
}
