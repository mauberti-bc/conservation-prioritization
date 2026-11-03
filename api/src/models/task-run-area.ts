import { Feature, Geometry } from 'geojson';
import { z } from 'zod';

/**
 * Immutable target-area feature belonging to a task run.
 */
export const TaskRunArea = z.object({
  task_run_area_id: z.string().uuid(),
  task_run_id: z.string().uuid(),
  area_index: z.coerce.number().int().nonnegative(),
  name: z.string(),
  description: z.string().nullable(),
  geojson: z.custom<Feature<Geometry>>()
});

export type TaskRunArea = z.infer<typeof TaskRunArea>;

export interface CreateTaskRunArea {
  area_index: number;
  name: string;
  description?: string | null;
  geojson: Feature<Geometry>;
}
