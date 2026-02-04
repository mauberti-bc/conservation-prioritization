import { z } from 'zod';

/**
 * Dashboard model with core fields.
 */
export const Dashboard = z.object({
  dashboard_id: z.string().uuid(),
  public_id: z.string().uuid(),
  name: z.string().max(100),
  description: z.string().max(500).nullable(),
  access_scheme: z.string(),
  created_at: z.string().optional(),
  created_by: z.string().uuid().optional(),
  updated_at: z.string().optional(),
  updated_by: z.string().uuid().nullable().optional(),
  record_effective_date: z.string().optional(),
  record_end_date: z.string().nullable().optional()
});

export type Dashboard = z.infer<typeof Dashboard>;

/**
 * Model for creating a dashboard.
 */
export const CreateDashboard = z.object({
  name: z.string().max(100),
  description: z.string().max(500).nullable(),
  access_scheme: z.string()
});

export type CreateDashboard = z.infer<typeof CreateDashboard>;
