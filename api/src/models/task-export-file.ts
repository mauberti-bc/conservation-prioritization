import { z } from 'zod';

/** Durable file metadata for one task export artifact. */
export const TaskExportFile = z.object({
  task_export_file_id: z.string().uuid(),
  task_export_id: z.string().uuid(),
  part_index: z.coerce.number().int(),
  filename: z.string(),
  object_key: z.string(),
  content_type: z.string(),
  byte_size: z.coerce.number().int(),
  checksum: z.string(),
  row_offset: z.coerce.number().int(),
  column_offset: z.coerce.number().int(),
  width: z.coerce.number().int(),
  height: z.coerce.number().int(),
  transform: z.record(z.unknown()),
  metadata: z.record(z.unknown())
});

export type TaskExportFile = z.infer<typeof TaskExportFile>;

export interface CreateTaskExportFile {
  task_export_id: string;
  part_index: number;
  filename: string;
  object_key: string;
  content_type?: string;
  byte_size: number;
  checksum: string;
  row_offset: number;
  column_offset: number;
  width: number;
  height: number;
  transform: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskExportFile {
  filename?: string;
  object_key?: string;
  content_type?: string;
  byte_size?: number;
  checksum?: string;
  row_offset?: number;
  column_offset?: number;
  width?: number;
  height?: number;
  transform?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
