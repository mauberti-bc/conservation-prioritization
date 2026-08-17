import { z } from 'zod';

/** Published immutable analytical source metadata. */
export const AnalyticalSource = z.object({
  analytical_source_id: z.string().uuid(),
  name: z.string(),
  version: z.string(),
  uri: z.string(),
  checksum: z.string().nullable(),
  format: z.string(),
  schema_metadata: z.record(z.unknown()),
  published_at: z.string().nullable(),
  is_default: z.boolean()
});

export type AnalyticalSource = z.infer<typeof AnalyticalSource>;

/** Request used only after a source manifest has been durably committed. */
export interface PublishAnalyticalSource {
  name: string;
  version: string;
  uri: string;
  checksum: string;
  format: 'zarr';
  schema_metadata: Record<string, unknown>;
  is_default: boolean;
}
