import { Knex } from 'knex';

/**
 * Add task-run GeoTIFF export job and file metadata tables.
 *
 * @param {Knex} knex Knex connection used to execute the migration.
 * @returns {Promise<void>} Resolves when the operation completes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    CREATE TYPE task_export_status AS ENUM ('queued', 'running', 'ready', 'failed');
    CREATE TYPE task_export_format AS ENUM ('geotiff', 'geodatabase');

    CREATE TABLE task_export (
      task_export_id uuid DEFAULT gen_random_uuid(),
      task_run_id uuid NOT NULL,
      source_artifact_id uuid NOT NULL,
      format task_export_format NOT NULL DEFAULT 'geotiff',
      format_version varchar(100) NOT NULL,
      status task_export_status NOT NULL DEFAULT 'queued',
      attempt integer NOT NULL DEFAULT 1,
      prefect_flow_run_id uuid,
      prefect_deployment_id uuid,
      source_checksum varchar(255),
      specification jsonb NOT NULL DEFAULT '{}'::jsonb,
      progress jsonb NOT NULL DEFAULT '{}'::jsonb,
      resource_admission jsonb,
      failure_code varchar(100),
      failure_message varchar(1000),
      started_at timestamptz(6),
      completed_at timestamptz(6),
      failed_at timestamptz(6),
      created_at timestamptz(6) DEFAULT now() NOT NULL,
      updated_at timestamptz(6),
      created_by uuid NOT NULL,
      updated_by uuid,
      CONSTRAINT task_export_pk PRIMARY KEY (task_export_id),
      CONSTRAINT task_export_run_fk FOREIGN KEY (task_run_id) REFERENCES task_run(task_run_id) ON DELETE CASCADE,
      CONSTRAINT task_export_source_artifact_fk FOREIGN KEY (source_artifact_id) REFERENCES artifact(artifact_id) ON DELETE RESTRICT,
      CONSTRAINT task_export_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT task_export_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL,
      CONSTRAINT task_export_attempt_ck CHECK (attempt > 0)
    );

    CREATE INDEX task_export_run_idx ON task_export (task_run_id, created_at DESC);
    CREATE INDEX task_export_status_idx ON task_export (status);
    CREATE UNIQUE INDEX task_export_prefect_flow_uk ON task_export (prefect_flow_run_id) WHERE prefect_flow_run_id IS NOT NULL;

    CREATE TABLE task_export_file (
      task_export_file_id uuid DEFAULT gen_random_uuid(),
      task_export_id uuid NOT NULL,
      part_index integer NOT NULL,
      filename varchar(255) NOT NULL,
      object_key text NOT NULL,
      content_type varchar(255) NOT NULL DEFAULT 'image/tiff',
      byte_size bigint NOT NULL,
      checksum varchar(255) NOT NULL,
      row_offset integer NOT NULL,
      column_offset integer NOT NULL,
      width integer NOT NULL,
      height integer NOT NULL,
      transform jsonb NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz(6) DEFAULT now() NOT NULL,
      updated_at timestamptz(6),
      created_by uuid NOT NULL,
      updated_by uuid,
      CONSTRAINT task_export_file_pk PRIMARY KEY (task_export_file_id),
      CONSTRAINT task_export_file_export_fk FOREIGN KEY (task_export_id) REFERENCES task_export(task_export_id) ON DELETE CASCADE,
      CONSTRAINT task_export_file_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT task_export_file_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL,
      CONSTRAINT task_export_file_part_index_ck CHECK (part_index >= 0),
      CONSTRAINT task_export_file_byte_size_ck CHECK (byte_size > 0),
      CONSTRAINT task_export_file_window_ck CHECK (row_offset >= 0 AND column_offset >= 0 AND width > 0 AND height > 0)
    );

    CREATE UNIQUE INDEX task_export_file_part_uk ON task_export_file (task_export_id, part_index);
    CREATE UNIQUE INDEX task_export_file_window_uk ON task_export_file (task_export_id, row_offset, column_offset);

    CREATE FUNCTION tr_notify_task_export() RETURNS trigger AS $$
    DECLARE
      export_task_run_id uuid;
    BEGIN
      export_task_run_id := COALESCE(NEW.task_run_id, OLD.task_run_id);
      UPDATE task_run
      SET revision = revision + 1, updated_at = now()
      WHERE task_run_id = export_task_run_id;
      PERFORM pg_notify(
        'conservation_realtime',
        json_build_object(
          'type', 'task_export.updated',
          'task_run_id', export_task_run_id,
          'task_export_id', COALESCE(NEW.task_export_id, OLD.task_export_id)
        )::text
      );
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE FUNCTION tr_notify_task_export_file() RETURNS trigger AS $$
    DECLARE
      export_task_run_id uuid;
      export_id uuid;
    BEGIN
      export_id := COALESCE(NEW.task_export_id, OLD.task_export_id);
      SELECT task_run_id INTO export_task_run_id
      FROM task_export
      WHERE task_export_id = export_id;
      UPDATE task_run
      SET revision = revision + 1, updated_at = now()
      WHERE task_run_id = export_task_run_id;
      PERFORM pg_notify(
        'conservation_realtime',
        json_build_object(
          'type', 'task_export_file.updated',
          'task_run_id', export_task_run_id,
          'task_export_id', export_id,
          'task_export_file_id', COALESCE(NEW.task_export_file_id, OLD.task_export_file_id)
        )::text
      );
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_notify_task_export
      AFTER INSERT OR UPDATE OR DELETE ON task_export
      FOR EACH ROW EXECUTE FUNCTION tr_notify_task_export();

    CREATE TRIGGER trg_notify_task_export_file
      AFTER INSERT OR UPDATE OR DELETE ON task_export_file
      FOR EACH ROW EXECUTE FUNCTION tr_notify_task_export_file();

    CREATE TRIGGER trg_journal_task_export
      BEFORE INSERT OR UPDATE OR DELETE ON task_export
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    CREATE TRIGGER trg_audit_task_export
      AFTER INSERT OR UPDATE OR DELETE ON task_export
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    CREATE TRIGGER trg_journal_task_export_file
      BEFORE INSERT OR UPDATE OR DELETE ON task_export_file
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    CREATE TRIGGER trg_audit_task_export_file
      AFTER INSERT OR UPDATE OR DELETE ON task_export_file
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();
  `);
}

/**
 * Remove task-run GeoTIFF export metadata tables.
 *
 * @param {Knex} knex Knex connection used to execute the migration.
 * @returns {Promise<void>} Resolves when the operation completes.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    DROP TRIGGER IF EXISTS trg_audit_task_export_file ON task_export_file;
    DROP TRIGGER IF EXISTS trg_journal_task_export_file ON task_export_file;
    DROP TRIGGER IF EXISTS trg_audit_task_export ON task_export;
    DROP TRIGGER IF EXISTS trg_journal_task_export ON task_export;
    DROP TRIGGER IF EXISTS trg_notify_task_export_file ON task_export_file;
    DROP TRIGGER IF EXISTS trg_notify_task_export ON task_export;
    DROP FUNCTION IF EXISTS tr_notify_task_export_file();
    DROP FUNCTION IF EXISTS tr_notify_task_export();
    DROP TABLE IF EXISTS task_export_file;
    DROP TABLE IF EXISTS task_export;
    DROP TYPE IF EXISTS task_export_format;
    DROP TYPE IF EXISTS task_export_status;
  `);
}
