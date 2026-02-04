import { z } from 'zod';

/**
 * ProjectTask model representing the association between projects and tasks.
 */
export const ProjectTask = z.object({
  project_task_id: z.string().uuid(),
  project_id: z.string().uuid(),
  task_id: z.string().uuid()
});

export type ProjectTask = z.infer<typeof ProjectTask>;

/** Type for creating a new project-task association */
export const CreateProjectTask = z.object({
  project_id: z.string().uuid(),
  task_id: z.string().uuid()
});

export type CreateProjectTask = z.infer<typeof CreateProjectTask>;

/** Type for deleting a project-task association */
export const DeleteProjectTask = z.object({
  project_task_id: z.string().uuid()
});

export type DeleteProjectTask = z.infer<typeof DeleteProjectTask>;
