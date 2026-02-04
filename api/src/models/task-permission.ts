import { z } from 'zod';

/**
 * TaskPermission model representing core fields of a task permission.
 */
export const TaskPermission = z.object({
  task_permission_id: z.string().uuid(),
  task_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  role_id: z.string().uuid() // Role ID referencing the role table
});

export type TaskPermission = z.infer<typeof TaskPermission>;

/** Type for creating a new task permission */
export const CreateTaskPermission = z.object({
  task_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  role_id: z.string().uuid() // Now requires role_id instead of name/description
});

export type CreateTaskPermission = z.infer<typeof CreateTaskPermission>;

/** Type for updating an existing task permission */
export const UpdateTaskPermission = z.object({
  task_id: z.string().uuid().optional(),
  profile_id: z.string().uuid().optional(),
  role_id: z.string().uuid().optional() // Can optionally update role_id
});

export type UpdateTaskPermission = z.infer<typeof UpdateTaskPermission>;

/** Type for deleting a task permission */
export const DeleteTaskPermission = z.object({
  task_permission_id: z.string().uuid()
});

export type DeleteTaskPermission = z.infer<typeof DeleteTaskPermission>;
