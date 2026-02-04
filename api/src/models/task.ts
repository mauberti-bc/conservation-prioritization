import { z } from 'zod';
import { Geometry } from './geometry';

/**
 * Task status enum for lifecycle tracking.
 */
export const TaskStatus = z.enum([
  'draft',
  'pending',
  'submitted',
  'running',
  'completed',
  'failed',
  'failed_to_submit'
]);

export type TaskStatus = z.infer<typeof TaskStatus>;

/**
 * Task Model with core fields.
 */
export const Task = z.object({
  task_id: z.string().uuid(), // UUID type for task_id
  name: z.string().max(100), // Task name (Max length 100)
  description: z.string().max(500).nullable(), // Task description (Max length 500, optional)
  resolution: z.number().int().nullable().optional(), // Requested resolution in meters
  resampling: z.enum(['mode', 'min', 'max']).nullable().optional(), // Resampling method
  variant: z.enum(['strict', 'approximate']).nullable().optional(), // Optimization variant
  tileset_uri: z.string().max(2000).nullable(), // Latest tileset URI
  output_uri: z.string().max(2000).nullable(), // Strict optimization output URI
  status: TaskStatus, // Current task status
  status_message: z.string().max(500).nullable(), // Optional status message
  prefect_flow_run_id: z.string().uuid().nullable(), // Prefect flow run ID
  prefect_deployment_id: z.string().uuid().nullable(), // Prefect deployment ID
  geometries: z.array(Geometry).optional() // Associated geometries
});

export type Task = z.infer<typeof Task>;

/**
 * Type for creating a new task (Excludes `task_id` which is auto-generated).
 */
export const CreateTask = Task.omit({
  task_id: true,
  tileset_uri: true,
  output_uri: true,
  geometries: true,
  status_message: true,
  prefect_flow_run_id: true,
  prefect_deployment_id: true
});

export type CreateTask = z.infer<typeof CreateTask>;

/**
 * Type for updating an existing task (Partial to allow updates to any of the fields).
 */
export const UpdateTask = Task.pick({
  name: true,
  description: true,
  resolution: true,
  resampling: true,
  variant: true
}).partial();

/**
 * Type for updating task execution metadata.
 */
export const UpdateTaskExecution = z
  .object({
    status: TaskStatus.optional(),
    status_message: z.string().max(500).nullable().optional(),
    prefect_flow_run_id: z.string().uuid().nullable().optional(),
    prefect_deployment_id: z.string().uuid().nullable().optional(),
    tileset_uri: z.string().max(2000).nullable().optional(),
    output_uri: z.string().max(2000).nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update task execution metadata.'
  });

export type UpdateTaskExecution = z.infer<typeof UpdateTaskExecution>;

export type UpdateTask = z.infer<typeof UpdateTask>;

/**
 * Type for deleting a task (Only requires `task_id`).
 */
export const DeleteTask = z.object({
  task_id: z.string().uuid()
});

export type DeleteTask = z.infer<typeof DeleteTask>;
