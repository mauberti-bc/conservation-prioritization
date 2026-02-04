import { Knex } from 'knex';

/**
 * Add task tile tracking table and task tileset reference.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    DO $$ BEGIN
      CREATE TYPE task_tile_status AS ENUM ('DRAFT', 'STARTED', 'COMPLETED', 'FAILED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE task
      ADD COLUMN tileset_uri text;

    COMMENT ON COLUMN task.tileset_uri IS 'URI for the latest tileset artifact.';

    CREATE TABLE IF NOT EXISTS task_tile (
      task_tile_id           uuid              DEFAULT gen_random_uuid(),
      task_id                uuid              NOT NULL,
      status                 task_tile_status  NOT NULL,
      uri                    text,
      content_type           text,
      started_at             timestamptz(6),
      completed_at           timestamptz(6),
      failed_at              timestamptz(6),
      error_code             text,
      error_message          varchar(500),
      created_at            timestamptz(6)    DEFAULT now() NOT NULL,
      created_by             uuid              NOT NULL,
      updated_at            timestamptz(6),
      updated_by         uuid,
      CONSTRAINT task_tile_pk PRIMARY KEY (task_tile_id)
    );

    COMMENT ON TABLE task_tile IS 'Tracks tiling artifacts for tasks.';
    COMMENT ON COLUMN task_tile.task_tile_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN task_tile.task_id IS 'Foreign key referencing task.';
    COMMENT ON COLUMN task_tile.status IS 'Status of the tiling job.';
    COMMENT ON COLUMN task_tile.uri IS 'URI for the generated PMTiles archive.';
    COMMENT ON COLUMN task_tile.content_type IS 'Content type for the PMTiles artifact.';
    COMMENT ON COLUMN task_tile.started_at IS 'Timestamp when tiling started.';
    COMMENT ON COLUMN task_tile.completed_at IS 'Timestamp when tiling completed.';
    COMMENT ON COLUMN task_tile.failed_at IS 'Timestamp when tiling failed.';
    COMMENT ON COLUMN task_tile.error_code IS 'Optional error code for tiling failures.';
    COMMENT ON COLUMN task_tile.error_message IS 'Optional error message for tiling failures.';
    COMMENT ON COLUMN task_tile.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN task_tile.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN task_tile.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN task_tile.updated_by IS 'The id of the profile who updated the record.';

    ALTER TABLE task_tile ADD CONSTRAINT task_tile_fk1
      FOREIGN KEY (task_id) REFERENCES task(task_id);

    CREATE INDEX task_tile_idx1 ON task_tile(task_id);
    CREATE UNIQUE INDEX task_tile_uk1 ON task_tile (task_id) WHERE status IN ('DRAFT', 'STARTED');
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    DROP TABLE IF EXISTS task_tile;
    ALTER TABLE task DROP COLUMN IF EXISTS tileset_uri;
    DROP TYPE IF EXISTS task_tile_status;
  `);
}
