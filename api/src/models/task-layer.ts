import { z } from 'zod';

/**
 * TaskLayer model representing the task layer in the system.
 */
export const TaskLayer = z.object({
  task_layer_id: z.string().uuid(),
  task_id: z.string().uuid(),
  layer_name: z.string().max(100),
  description: z.string().max(500).nullable(),
  mode: z.enum(['flexible', 'locked-in', 'locked-out']),
  importance: z.number().nullable().optional(),
  threshold: z.number().nullable().optional()
});

export type TaskLayer = z.infer<typeof TaskLayer>;

/** Type for creating a new task layer */
export const CreateTaskLayer = z.object({
  task_id: z.string().uuid(),
  layer_name: z.string().max(100),
  description: z.string().max(500).nullable(),
  mode: z.enum(['flexible', 'locked-in', 'locked-out']),
  importance: z.number().nullable().optional(),
  threshold: z.number().nullable().optional()
});

export type CreateTaskLayer = z.infer<typeof CreateTaskLayer>;

/** Type for deleting a task layer */
export const DeleteTaskLayer = z.object({
  task_layer_id: z.string().uuid()
});

export type DeleteTaskLayer = z.infer<typeof DeleteTaskLayer>;
