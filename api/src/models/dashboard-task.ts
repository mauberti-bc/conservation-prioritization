import { z } from 'zod';

/**
 * Dashboard task join model.
 */
export const DashboardTask = z.object({
  dashboard_task_id: z.string().uuid(),
  dashboard_id: z.string().uuid(),
  task_id: z.string().uuid()
});

export type DashboardTask = z.infer<typeof DashboardTask>;

/**
 * Model for creating a dashboard task join.
 */
export const CreateDashboardTask = z.object({
  dashboard_id: z.string().uuid(),
  task_id: z.string().uuid()
});

export type CreateDashboardTask = z.infer<typeof CreateDashboardTask>;
