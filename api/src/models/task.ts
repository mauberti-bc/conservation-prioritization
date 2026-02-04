import { z } from 'zod';

/**
 * Task Model with core fields.
 */
export const Task = z.object({
  task_id: z.string().uuid(), // UUID type for task_id
  name: z.string().max(100), // Task name (Max length 100)
  description: z.string().max(500).nullable() // Task description (Max length 500, optional)
});

export type Task = z.infer<typeof Task>;

/**
 * Type for creating a new task (Excludes `task_id` which is auto-generated).
 */
export const CreateTask = Task.omit({ task_id: true });

export type CreateTask = z.infer<typeof CreateTask>;

/**
 * Type for updating an existing task (Partial to allow updates to any of the fields).
 */
export const UpdateTask = Task.pick({
  name: true,
  description: true
}).partial();

export type UpdateTask = z.infer<typeof UpdateTask>;

/**
 * Type for deleting a task (Only requires `task_id`).
 */
export const DeleteTask = z.object({
  task_id: z.string().uuid()
});

export type DeleteTask = z.infer<typeof DeleteTask>;
