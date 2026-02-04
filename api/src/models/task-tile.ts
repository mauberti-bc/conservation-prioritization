import { z } from 'zod';

/**
 * Task tile status for tiling lifecycle.
 */
export const TaskTileStatus = z.enum(['DRAFT', 'STARTED', 'COMPLETED', 'FAILED']);

export type TaskTileStatus = z.infer<typeof TaskTileStatus>;

/**
 * TaskTile model representing tiling artifacts for a task.
 */
export const TaskTile = z.object({
  task_tile_id: z.string().uuid(),
  task_id: z.string().uuid(),
  status: TaskTileStatus,
  pmtiles_uri: z.string().nullable(),
  content_type: z.string().nullable(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  failed_at: z.string().nullable().optional(),
  error_code: z.string().nullable().optional(),
  error_message: z.string().max(500).nullable().optional()
});

export type TaskTile = z.infer<typeof TaskTile>;

/**
 * Type for creating a new task tile record.
 */
export const CreateTaskTile = z.object({
  task_id: z.string().uuid(),
  status: TaskTileStatus,
  pmtiles_uri: z.string().nullable().optional(),
  content_type: z.string().nullable().optional()
});

export type CreateTaskTile = z.infer<typeof CreateTaskTile>;

/**
 * Type for updating task tile status and artifact metadata.
 */
export const UpdateTaskTile = z.object({
  status: TaskTileStatus.optional(),
  pmtiles_uri: z.string().nullable().optional(),
  content_type: z.string().nullable().optional(),
  error_code: z.string().nullable().optional(),
  error_message: z.string().max(500).nullable().optional()
});

export type UpdateTaskTile = z.infer<typeof UpdateTaskTile>;
