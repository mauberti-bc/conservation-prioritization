import { z } from 'zod';

/**
 * Dashboard permission model.
 */
export const DashboardPermission = z.object({
  dashboard_permission_id: z.string().uuid(),
  dashboard_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  role_id: z.string().uuid()
});

export type DashboardPermission = z.infer<typeof DashboardPermission>;

/**
 * Model for creating a dashboard permission.
 */
export const CreateDashboardPermission = z.object({
  dashboard_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  role_id: z.string().uuid()
});

export type CreateDashboardPermission = z.infer<typeof CreateDashboardPermission>;
