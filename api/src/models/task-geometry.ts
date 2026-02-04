import { z } from 'zod';

/**
 * Task geometry model for join records.
 */
export const TaskGeometry = z.object({
  task_geometry_id: z.string().uuid(),
  task_id: z.string().uuid(),
  geometry_id: z.string().uuid()
});

export type TaskGeometry = z.infer<typeof TaskGeometry>;

/**
 * Model for creating a task geometry join record.
 */
export const CreateTaskGeometry = z.object({
  task_id: z.string().uuid(),
  geometry_id: z.string().uuid()
});

export type CreateTaskGeometry = z.infer<typeof CreateTaskGeometry>;

/**
 * Model for returning geometries associated with tasks.
 */
export const TaskGeometryWithGeometry = z.object({
  task_id: z.string().uuid(),
  geometry_id: z.string().uuid(),
  name: z.string().max(100),
  description: z.string().max(500).nullable(),
  geojson: z.unknown()
});

export type TaskGeometryWithGeometry = z.infer<typeof TaskGeometryWithGeometry>;
