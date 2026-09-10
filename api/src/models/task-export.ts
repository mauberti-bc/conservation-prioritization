import { z } from 'zod';

export const TaskExportStatus = z.enum(['queued', 'running', 'ready', 'failed']);
export const TaskExportFormat = z.enum(['geotiff', 'geodatabase']);

/** Durable job-level metadata for a task-run export. */
export const TaskExport = z.object({
  task_export_id: z.string().uuid(),
  task_run_id: z.string().uuid(),
  source_artifact_id: z.string().uuid(),
  format: TaskExportFormat,
  format_version: z.string(),
  status: TaskExportStatus,
  attempt: z.coerce.number().int(),
  prefect_flow_run_id: z.string().uuid().nullable(),
  prefect_deployment_id: z.string().uuid().nullable(),
  source_checksum: z.string().nullable(),
  specification: z.record(z.unknown()),
  progress: z.record(z.unknown()),
  resource_admission: z.record(z.unknown()).nullable(),
  failure_code: z.string().nullable(),
  failure_message: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  failed_at: z.string().nullable()
});

export type TaskExport = z.infer<typeof TaskExport>;
export type TaskExportStatus = z.infer<typeof TaskExportStatus>;
export type TaskExportFormat = z.infer<typeof TaskExportFormat>;

export interface CreateTaskExport {
  task_run_id: string;
  source_artifact_id: string;
  format: TaskExportFormat;
  format_version: string;
  source_checksum?: string | null;
  specification?: Record<string, unknown>;
}

export interface UpdateTaskExport {
  status?: TaskExportStatus;
  attempt?: number;
  prefect_flow_run_id?: string | null;
  prefect_deployment_id?: string | null;
  progress?: Record<string, unknown>;
  resource_admission?: Record<string, unknown> | null;
  failure_code?: string | null;
  failure_message?: string | null;
}
