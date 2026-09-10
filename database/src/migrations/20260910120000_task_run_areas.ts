import { Knex } from 'knex';

/**
 * Creates the immutable task-run target-area table and backfills existing run snapshots.
 *
 * @param {Knex} knex Migration database connection.
 * @returns {Promise<void>} Resolves after the table, indexes, triggers, and backfilled features are committed.
 * @throws {Error} When PostgreSQL rejects the schema changes or backfill statement.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    CREATE TABLE task_run_area (
      task_run_area_id uuid DEFAULT gen_random_uuid(),
      task_run_id uuid NOT NULL,
      area_index integer NOT NULL,
      name varchar(200) NOT NULL,
      description varchar(500),
      geojson jsonb NOT NULL,
      created_at timestamptz(6) DEFAULT now() NOT NULL,
      created_by uuid,
      updated_at timestamptz(6),
      updated_by uuid,
      CONSTRAINT task_run_area_pk PRIMARY KEY (task_run_area_id),
      CONSTRAINT task_run_area_run_fk FOREIGN KEY (task_run_id) REFERENCES task_run(task_run_id) ON DELETE CASCADE,
      CONSTRAINT task_run_area_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id),
      CONSTRAINT task_run_area_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id),
      CONSTRAINT task_run_area_index_uk UNIQUE (task_run_id, area_index),
      CONSTRAINT task_run_area_index_ck CHECK (area_index >= 0),
      CONSTRAINT task_run_area_geojson_feature_ck CHECK (geojson->>'type' = 'Feature')
    );

    CREATE INDEX task_run_area_run_idx ON task_run_area (task_run_id, area_index);

    INSERT INTO task_run_area (task_run_id, area_index, name, geojson, created_at, created_by, updated_at, updated_by)
    SELECT
      task_run_id,
      area_index - 1,
      'Area ' || area_index,
      feature,
      created_at,
      created_by,
      updated_at,
      updated_by
    FROM (
      SELECT
        tr.task_run_id,
        tr.created_at,
        tr.created_by,
        tr.updated_at,
        tr.updated_by,
        area.feature,
        area.area_index
      FROM task_run tr
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN tr.input_snapshot->'target_area'->>'type' = 'FeatureCollection'
            THEN tr.input_snapshot->'target_area'->'features'
          WHEN tr.input_snapshot->'target_area'->>'type' = 'Feature'
            THEN jsonb_build_array(tr.input_snapshot->'target_area')
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY AS area(feature, area_index)
    ) persisted_areas;

    CREATE FUNCTION tr_task_run_area_touch_task_run() RETURNS trigger AS $$
    BEGIN
      UPDATE task_run
      SET revision = revision + 1, updated_at = now()
      WHERE task_run_id = COALESCE(NEW.task_run_id, OLD.task_run_id);
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_task_run_area_touch_task_run
      AFTER INSERT OR UPDATE OR DELETE ON task_run_area
      FOR EACH ROW EXECUTE FUNCTION tr_task_run_area_touch_task_run();

    CREATE TRIGGER trg_journal_task_run_area
      BEFORE INSERT OR UPDATE OR DELETE ON task_run_area
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    CREATE TRIGGER trg_audit_task_run_area
      AFTER INSERT OR UPDATE OR DELETE ON task_run_area
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();
  `);
}

/**
 * Removes the immutable task-run target-area table and its supporting triggers.
 *
 * @param {Knex} knex Migration database connection.
 * @returns {Promise<void>} Resolves after the target-area schema objects are removed.
 * @throws {Error} When PostgreSQL rejects the rollback statement.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    DROP TRIGGER IF EXISTS trg_audit_task_run_area ON task_run_area;
    DROP TRIGGER IF EXISTS trg_journal_task_run_area ON task_run_area;
    DROP TRIGGER IF EXISTS trg_task_run_area_touch_task_run ON task_run_area;
    DROP FUNCTION IF EXISTS tr_task_run_area_touch_task_run();
    DROP TABLE IF EXISTS task_run_area;
  `);
}
