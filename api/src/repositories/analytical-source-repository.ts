import { SQL } from 'sql-template-strings';
import { AnalyticalSource, PublishAnalyticalSource } from '../models/analytical-source';
import { BaseRepository } from './base-repository';

/** Repository for published analytical sources. */
export class AnalyticalSourceRepository extends BaseRepository {
  /**
   * Registers an already validated immutable source and atomically promotes it.
   *
   * @param {PublishAnalyticalSource} source Manifest-backed source metadata.
   * @returns {Promise<AnalyticalSource>} Published source record.
   */
  async publishSource(source: PublishAnalyticalSource): Promise<AnalyticalSource> {
    if (source.is_default) {
      await this.connection.sql(SQL`UPDATE analytical_source SET is_default = false WHERE is_default = true`);
    }
    const response = await this.connection.sql(
      SQL`INSERT INTO analytical_source (
            name, version, uri, checksum, format, schema_metadata, published_at, is_default
          ) VALUES (
            ${source.name}, ${source.version}, ${source.uri}, ${source.checksum}, ${source.format},
            ${JSON.stringify(source.schema_metadata)}::jsonb, now(), ${source.is_default}
          ) RETURNING analytical_source_id, name, version, uri, checksum, format, schema_metadata,
                      published_at, is_default`,
      AnalyticalSource
    );
    return response.rows[0];
  }

  /**
   * Returns the deployment's default immutable analytical source.
   *
   * @returns {Promise<AnalyticalSource | null>}
   */
  async getDefaultSource(): Promise<AnalyticalSource | null> {
    const response = await this.connection.sql(
      SQL`SELECT analytical_source_id, name, version, uri, checksum, format, schema_metadata,
                 published_at, is_default
          FROM analytical_source
          WHERE is_default = true
          LIMIT 1`,
      AnalyticalSource
    );

    return response.rows[0] ?? null;
  }
}
