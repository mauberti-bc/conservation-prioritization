import { z } from 'zod';

/**
 * ProjectProfile model, representing the association between a project, profile, and permission.
 *
 * @export
 * @type ProjectProfile
 */
export const ProjectProfile = z.object({
  project_profile_id: z.string().uuid(),
  project_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  project_permission_id: z.string().uuid(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable()
});

export type ProjectProfile = z.infer<typeof ProjectProfile>;

/**
 * ProjectProfile with task role name
 */
export const ProjectProfileExtended = ProjectProfile.extend({
  role_name: z.string()
});

export type ProjectProfileExtended = z.infer<typeof ProjectProfileExtended>;

/**
 * CreateProjectProfile type for inserting new project profile associations.
 *
 * @export
 * @type CreateProjectProfile
 */
export const CreateProjectProfile = z.object({
  project_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  project_permission_id: z.string().uuid()
});

export type CreateProjectProfile = z.infer<typeof CreateProjectProfile>;

/**
 * UpdateProjectProfile type for updating an existing project profile association.
 *
 * @export
 * @type UpdateProjectProfile
 */
export const UpdateProjectProfile = z.object({
  project_id: z.string().uuid().optional(),
  profile_id: z.string().uuid().optional(),
  project_permission_id: z.string().uuid().optional()
});

export type UpdateProjectProfile = z.infer<typeof UpdateProjectProfile>;

/**
 * DeleteProjectProfile type for deleting project profile associations.
 *
 * @export
 * @type DeleteProjectProfile
 */
export const DeleteProjectProfile = z.object({
  project_profile_id: z.string().uuid()
});

export type DeleteProjectProfile = z.infer<typeof DeleteProjectProfile>;
