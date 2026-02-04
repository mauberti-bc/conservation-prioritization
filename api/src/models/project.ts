import { z } from 'zod';

/**
 * Project model with core fields.
 */
export const Project = z.object({
  project_id: z.string().uuid(), // UUID type for project_id
  name: z.string().max(100), // Max length of 100 for project name
  description: z.string().max(500).nullable() // Optional project description
});

export type Project = z.infer<typeof Project>;

/**
 * Model for creating a project.
 */
export const CreateProject = z.object({
  name: z.string().max(100), // Max length of 100 for project name
  description: z.string().max(500).nullable() // Optional project description
});

export type CreateProject = z.infer<typeof CreateProject>;

/**
 * Model for updating a project.
 *
 * All fields are optional; only supplied fields will be updated.
 */
export const UpdateProject = z.object({
  name: z.string().max(100).optional(), // Optional project name
  description: z.string().max(500).nullable().optional() // Optional project description
});

export type UpdateProject = z.infer<typeof UpdateProject>;

/**
 * Model for deleting a project.
 */
export const DeleteProject = z.object({
  project_id: z.string().uuid() // UUID of the project to delete
});

export type DeleteProject = z.infer<typeof DeleteProject>;
