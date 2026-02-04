import { z } from 'zod';

/**
 * Geometry model with core fields.
 */
export const Geometry = z.object({
  geometry_id: z.string().uuid(),
  name: z.string().max(100),
  description: z.string().max(500).nullable(),
  geojson: z.unknown()
});

export type Geometry = z.infer<typeof Geometry>;

/**
 * Model for creating a geometry.
 */
export const CreateGeometry = z.object({
  name: z.string().max(100),
  description: z.string().max(500).nullable(),
  geojson: z.unknown()
});

export type CreateGeometry = z.infer<typeof CreateGeometry>;
