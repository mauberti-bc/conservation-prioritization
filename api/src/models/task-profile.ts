import { z } from 'zod';

/**
 * TaskProfile model representing core fields of a task-profile association.
 */
export const TaskProfile = z.object({
  task_profile_id: z.string().uuid(),
  task_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  task_permission_id: z.string().uuid()
});

export type TaskProfile = z.infer<typeof TaskProfile>;

/**
 * TaskProfile with task role name
 */
export const TaskProfileExtended = TaskProfile.extend({
  role_name: z.string()
});

export type TaskProfileExtended = z.infer<typeof TaskProfileExtended>;

/** Type for creating a new task profile */
export const CreateTaskProfile = z.object({
  task_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  task_permission_id: z.string().uuid()
});

export type CreateTaskProfile = z.infer<typeof CreateTaskProfile>;

/** Type for updating an existing task profile */
export const UpdateTaskProfile = z.object({
  task_permission_id: z.string().uuid().optional()
});

export type UpdateTaskProfile = z.infer<typeof UpdateTaskProfile>;

/** Type for deleting a task profile */
export const DeleteTaskProfile = z.object({
  task_profile_id: z.string().uuid()
});

export type DeleteTaskProfile = z.infer<typeof DeleteTaskProfile>;
