import { z } from 'zod';

/**
 * ProjectPermission model representing core fields of a project permission.
 */
export const ProjectPermission = z.object({
  project_permission_id: z.string().uuid(),
  project_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  role_id: z.string().uuid()
});

export type ProjectPermission = z.infer<typeof ProjectPermission>;

/** Type for creating a new project permission */
export const CreateProjectPermission = ProjectPermission.omit({
  project_permission_id: true
});

export type CreateProjectPermission = z.infer<typeof CreateProjectPermission>;

/** Type for updating an existing project permission */
export const UpdateProjectPermission = ProjectPermission.partial().omit({
  project_permission_id: true
});

export type UpdateProjectPermission = z.infer<typeof UpdateProjectPermission>;

/** Type for deleting a project permission */
export const DeleteProjectPermission = z.object({
  project_permission_id: z.string().uuid()
});

export type DeleteProjectPermission = z.infer<typeof DeleteProjectPermission>;
