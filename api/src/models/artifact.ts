import { z } from 'zod';

export const ArtifactStatus = z.enum(['pending', 'building', 'ready', 'failed']);
export const ArtifactType = z.enum([
  'planning_unit_inventory',
  'compiled_model',
  'raw_solver_result',
  'canonical_result',
  'canonical_export',
  'pmtiles'
]);

/** Durable metadata for a run or reusable analytical artifact. */
export const Artifact = z.object({
  artifact_id: z.string().uuid(),
  task_run_id: z.string().uuid().nullable(),
  type: ArtifactType,
  status: ArtifactStatus,
  uri: z.string().nullable(),
  content_type: z.string().nullable(),
  checksum: z.string().nullable(),
  size_bytes: z.coerce.number().nullable(),
  cache_key: z.string().nullable(),
  manifest: z.record(z.unknown()).nullable(),
  lineage: z.record(z.unknown()),
  failure_code: z.string().nullable(),
  failure_message: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  failed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable()
});

export type Artifact = z.infer<typeof Artifact>;
export type ArtifactStatus = z.infer<typeof ArtifactStatus>;
export type ArtifactType = z.infer<typeof ArtifactType>;

export interface CreateArtifact {
  task_run_id: string | null;
  type: ArtifactType;
  status?: ArtifactStatus;
  cache_key?: string | null;
  lineage?: Record<string, unknown>;
}

export interface UpdateArtifact {
  status?: ArtifactStatus;
  uri?: string | null;
  content_type?: string | null;
  checksum?: string | null;
  size_bytes?: number | null;
  manifest?: Record<string, unknown> | null;
  lineage?: Record<string, unknown>;
  failure_code?: string | null;
  failure_message?: string | null;
}
