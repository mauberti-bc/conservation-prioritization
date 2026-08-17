import { SQL, SQLStatement } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { Artifact, CreateArtifact, UpdateArtifact } from '../models/artifact';
import { BaseRepository } from './base-repository';

const ARTIFACT_COLUMNS = `artifact_id, task_run_id, type, status, uri, content_type, checksum,
  size_bytes, cache_key, manifest, lineage, failure_code, failure_message,
  started_at, completed_at, failed_at, created_at, updated_at`;

/** Repository for durable artifact metadata and finalization. */
export class ArtifactRepository extends BaseRepository {
  /** Creates an artifact metadata record. */
  async createArtifact(artifact: CreateArtifact): Promise<Artifact> {
    const response = await this.connection.sql(
      SQL`INSERT INTO artifact (task_run_id, type, status, cache_key, lineage)
          VALUES (${artifact.task_run_id}, ${artifact.type}, ${artifact.status ?? 'pending'},
                  ${artifact.cache_key ?? null}, ${JSON.stringify(artifact.lineage ?? {})}::jsonb)
          RETURNING `.append(ARTIFACT_COLUMNS),
      Artifact
    );
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create artifact', ['ArtifactRepository->createArtifact']);
    }
    return response.rows[0];
  }

  /** Returns all artifacts for a run. */
  async getArtifactsByRunId(taskRunId: string): Promise<Artifact[]> {
    const response = await this.connection.sql(
      SQL`SELECT `
        .append(ARTIFACT_COLUMNS)
        .append(SQL` FROM artifact WHERE task_run_id = ${taskRunId} ORDER BY created_at`),
      Artifact
    );
    return response.rows;
  }

  /** Returns a run artifact by its unique role. */
  async getArtifactByRunAndType(taskRunId: string, type: Artifact['type']): Promise<Artifact> {
    const response = await this.connection.sql(
      SQL`SELECT `.append(ARTIFACT_COLUMNS).append(
        SQL` FROM artifact
              WHERE task_run_id = ${taskRunId}
                AND type = ${type}`
      ),
      Artifact
    );
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to fetch run artifact', ['ArtifactRepository->getArtifactByRunAndType']);
    }
    return response.rows[0];
  }

  /** Updates artifact state; ready artifacts require a committed manifest and checksum. */
  async updateArtifact(artifactId: string, updates: UpdateArtifact): Promise<Artifact> {
    if (updates.status === 'ready' && (!updates.uri || !updates.checksum || !updates.manifest)) {
      throw new ApiExecuteSQLError('Ready artifacts require URI, checksum, and manifest', [
        'ArtifactRepository->updateArtifact'
      ]);
    }

    const statement = SQL`UPDATE artifact SET updated_at = now()`;
    const fields: SQLStatement[] = [];
    if (updates.status !== undefined) {
      fields.push(SQL`status = ${updates.status}`);
    }
    if (updates.uri !== undefined) {
      fields.push(SQL`uri = ${updates.uri}`);
    }
    if (updates.content_type !== undefined) {
      fields.push(SQL`content_type = ${updates.content_type}`);
    }
    if (updates.checksum !== undefined) {
      fields.push(SQL`checksum = ${updates.checksum}`);
    }
    if (updates.size_bytes !== undefined) {
      fields.push(SQL`size_bytes = ${updates.size_bytes}`);
    }
    if (updates.manifest !== undefined) {
      fields.push(SQL`manifest = ${JSON.stringify(updates.manifest)}::jsonb`);
    }
    if (updates.lineage !== undefined) {
      fields.push(SQL`lineage = ${JSON.stringify(updates.lineage)}::jsonb`);
    }
    if (updates.failure_code !== undefined) {
      fields.push(SQL`failure_code = ${updates.failure_code}`);
    }
    if (updates.failure_message !== undefined) {
      fields.push(SQL`failure_message = ${updates.failure_message}`);
    }
    for (const field of fields) {
      statement.append(SQL`, `).append(field);
    }
    if (updates.status === 'building') {
      statement.append(
        SQL`, started_at = COALESCE(started_at, now()), failed_at = NULL, failure_code = NULL, failure_message = NULL`
      );
    }
    if (updates.status === 'ready') {
      statement.append(SQL`, completed_at = now(), failed_at = NULL, failure_code = NULL, failure_message = NULL`);
    }
    if (updates.status === 'failed') {
      statement.append(SQL`, failed_at = now()`);
    }
    statement.append(SQL` WHERE artifact_id = ${artifactId} RETURNING `).append(ARTIFACT_COLUMNS);

    const response = await this.connection.sql(statement, Artifact);
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update artifact', ['ArtifactRepository->updateArtifact']);
    }
    return response.rows[0];
  }
}
