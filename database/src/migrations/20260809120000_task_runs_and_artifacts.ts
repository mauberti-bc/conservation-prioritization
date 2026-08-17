import { Knex } from 'knex';

/**
 * Introduce immutable task runs, published analytical sources, and run artifacts.
 *
 * @param {Knex} knex Database connection.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    CREATE TYPE task_run_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
    CREATE TYPE task_run_strategy AS ENUM ('strict', 'approximate');
    CREATE TYPE task_run_stage AS ENUM ('preparing', 'compiling', 'solving', 'materializing', 'publishing');
    CREATE TYPE artifact_status AS ENUM ('pending', 'building', 'ready', 'failed');
    CREATE TYPE artifact_type AS ENUM (
      'planning_unit_mask',
      'feature_representation',
      'cost_vector',
      'base_topology',
      'connectivity',
      'compiled_model',
      'raw_solver_result',
      'canonical_result',
      'pmtiles'
    );

    CREATE TABLE analytical_source (
      analytical_source_id uuid DEFAULT gen_random_uuid(),
      name varchar(200) NOT NULL,
      version varchar(200) NOT NULL,
      uri text NOT NULL,
      checksum varchar(255),
      format varchar(50) NOT NULL DEFAULT 'zarr',
      schema_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      published_at timestamptz(6),
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamptz(6) DEFAULT now() NOT NULL,
      updated_at timestamptz(6),
      CONSTRAINT analytical_source_pk PRIMARY KEY (analytical_source_id),
      CONSTRAINT analytical_source_name_version_uk UNIQUE (name, version)
    );

    CREATE UNIQUE INDEX analytical_source_default_uk
      ON analytical_source (is_default)
      WHERE is_default = true;

    CREATE TABLE task_run (
      task_run_id uuid DEFAULT gen_random_uuid(),
      task_id uuid NOT NULL,
      analytical_source_id uuid,
      strategy task_run_strategy NOT NULL,
      status task_run_status NOT NULL DEFAULT 'queued',
      stage task_run_stage,
      revision bigint NOT NULL DEFAULT 1,
      input_snapshot jsonb NOT NULL,
      input_hash char(64) NOT NULL,
      planning_unit_definition jsonb NOT NULL,
      solver_config jsonb NOT NULL DEFAULT '{}'::jsonb,
      code_version varchar(255),
      solver_status varchar(100),
      objective_value numeric,
      optimality_gap numeric,
      runtime_seconds numeric,
      prefect_flow_run_id uuid,
      prefect_deployment_id uuid,
      dispatch_attempts integer NOT NULL DEFAULT 0,
      failure_code varchar(100),
      failure_message varchar(1000),
      started_at timestamptz(6),
      completed_at timestamptz(6),
      failed_at timestamptz(6),
      cancelled_at timestamptz(6),
      created_at timestamptz(6) DEFAULT now() NOT NULL,
      updated_at timestamptz(6),
      created_by uuid NOT NULL,
      updated_by uuid,
      CONSTRAINT task_run_pk PRIMARY KEY (task_run_id),
      CONSTRAINT task_run_task_fk FOREIGN KEY (task_id) REFERENCES task(task_id) ON DELETE CASCADE,
      CONSTRAINT task_run_source_fk FOREIGN KEY (analytical_source_id) REFERENCES analytical_source(analytical_source_id) ON DELETE RESTRICT,
      CONSTRAINT task_run_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT task_run_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE INDEX task_run_task_idx ON task_run (task_id, created_at DESC);
    CREATE INDEX task_run_dispatch_idx ON task_run (status, prefect_flow_run_id) WHERE status = 'queued';
    CREATE UNIQUE INDEX task_run_prefect_flow_uk ON task_run (prefect_flow_run_id) WHERE prefect_flow_run_id IS NOT NULL;

    CREATE TABLE artifact (
      artifact_id uuid DEFAULT gen_random_uuid(),
      task_run_id uuid,
      type artifact_type NOT NULL,
      status artifact_status NOT NULL DEFAULT 'pending',
      uri text,
      content_type varchar(255),
      checksum varchar(255),
      size_bytes bigint,
      cache_key char(64),
      manifest jsonb,
      lineage jsonb NOT NULL DEFAULT '{}'::jsonb,
      failure_code varchar(100),
      failure_message varchar(1000),
      started_at timestamptz(6),
      completed_at timestamptz(6),
      failed_at timestamptz(6),
      created_at timestamptz(6) DEFAULT now() NOT NULL,
      updated_at timestamptz(6),
      created_by uuid NOT NULL,
      updated_by uuid,
      CONSTRAINT artifact_pk PRIMARY KEY (artifact_id),
      CONSTRAINT artifact_run_fk FOREIGN KEY (task_run_id) REFERENCES task_run(task_run_id) ON DELETE CASCADE,
      CONSTRAINT artifact_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT artifact_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL,
      CONSTRAINT artifact_ready_ck CHECK (status <> 'ready' OR (uri IS NOT NULL AND checksum IS NOT NULL))
    );

    CREATE UNIQUE INDEX artifact_run_type_uk ON artifact (task_run_id, type) WHERE task_run_id IS NOT NULL;
    CREATE INDEX artifact_cache_idx ON artifact (cache_key, type) WHERE cache_key IS NOT NULL;

    CREATE FUNCTION tr_task_run_immutable() RETURNS trigger AS $$
    BEGIN
      IF OLD.task_id IS DISTINCT FROM NEW.task_id
      OR OLD.analytical_source_id IS DISTINCT FROM NEW.analytical_source_id
        OR OLD.strategy IS DISTINCT FROM NEW.strategy
        OR OLD.input_snapshot IS DISTINCT FROM NEW.input_snapshot
        OR OLD.input_hash IS DISTINCT FROM NEW.input_hash
        OR OLD.planning_unit_definition IS DISTINCT FROM NEW.planning_unit_definition
        OR OLD.solver_config IS DISTINCT FROM NEW.solver_config
        OR OLD.code_version IS DISTINCT FROM NEW.code_version THEN
        RAISE EXCEPTION 'Task run inputs are immutable after creation.';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_task_run_immutable
      BEFORE UPDATE ON task_run
      FOR EACH ROW EXECUTE FUNCTION tr_task_run_immutable();

    CREATE FUNCTION tr_analytical_source_immutable() RETURNS trigger AS $$
    BEGIN
      IF OLD.name IS DISTINCT FROM NEW.name
        OR OLD.version IS DISTINCT FROM NEW.version
        OR OLD.uri IS DISTINCT FROM NEW.uri
        OR OLD.checksum IS DISTINCT FROM NEW.checksum
        OR OLD.format IS DISTINCT FROM NEW.format
        OR OLD.schema_metadata IS DISTINCT FROM NEW.schema_metadata
        OR OLD.published_at IS DISTINCT FROM NEW.published_at THEN
        RAISE EXCEPTION 'Published analytical source metadata is immutable.';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_analytical_source_immutable
      BEFORE UPDATE ON analytical_source
      FOR EACH ROW EXECUTE FUNCTION tr_analytical_source_immutable();

    CREATE FUNCTION tr_notify_task_run() RETURNS trigger AS $$
    BEGIN
      PERFORM pg_notify(
        'conservation_realtime',
        json_build_object(
          'type', 'task_run.updated',
          'task_id', NEW.task_id,
          'task_run_id', NEW.task_run_id,
          'revision', NEW.revision
        )::text
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_notify_task_run
      AFTER INSERT OR UPDATE ON task_run
      FOR EACH ROW EXECUTE FUNCTION tr_notify_task_run();

    CREATE FUNCTION tr_artifact_touch_task_run() RETURNS trigger AS $$
    BEGIN
      UPDATE task_run
      SET revision = revision + 1, updated_at = now()
      WHERE task_run_id = COALESCE(NEW.task_run_id, OLD.task_run_id);
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_artifact_touch_task_run
      AFTER INSERT OR UPDATE OR DELETE ON artifact
      FOR EACH ROW EXECUTE FUNCTION tr_artifact_touch_task_run();

    CREATE FUNCTION tr_notify_profile_scope() RETURNS trigger AS $$
    DECLARE
      affected_profile_id uuid;
    BEGIN
      affected_profile_id := COALESCE(NEW.profile_id, OLD.profile_id);
      PERFORM pg_notify(
        'conservation_realtime',
        json_build_object(
          'type', 'profile_scope.updated',
          'profile_id', affected_profile_id
        )::text
      );
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_notify_task_profile_scope
      AFTER INSERT OR UPDATE OR DELETE ON task_profile
      FOR EACH ROW EXECUTE FUNCTION tr_notify_profile_scope();

    CREATE TRIGGER trg_notify_task_permission_scope
      AFTER INSERT OR UPDATE OR DELETE ON task_permission
      FOR EACH ROW EXECUTE FUNCTION tr_notify_profile_scope();

    CREATE TRIGGER trg_journal_task_run
      BEFORE INSERT OR UPDATE OR DELETE ON task_run
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    CREATE TRIGGER trg_audit_task_run
      AFTER INSERT OR UPDATE OR DELETE ON task_run
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    CREATE TRIGGER trg_journal_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON artifact
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    CREATE TRIGGER trg_audit_artifact
      AFTER INSERT OR UPDATE OR DELETE ON artifact
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    INSERT INTO analytical_source (name, version, uri, format, schema_metadata, is_default)
    VALUES (
      'legacy_species_atlas',
      'legacy_unversioned',
      'legacy://unversioned',
      'zarr',
      '{"lineage":"incomplete","base_resolution":5000}'::jsonb,
      true
    );

    INSERT INTO task_run (
      task_id,
      analytical_source_id,
      strategy,
      status,
      stage,
      input_snapshot,
      input_hash,
      planning_unit_definition,
      solver_config,
      code_version,
      solver_status,
      prefect_flow_run_id,
      prefect_deployment_id,
      failure_message,
      started_at,
      completed_at,
      failed_at,
      created_at,
      updated_at,
      created_by,
      updated_by
    )
    SELECT
      t.task_id,
      source.analytical_source_id,
      CASE
        WHEN t.variant = 'approximate' THEN 'approximate'::task_run_strategy
        ELSE 'strict'::task_run_strategy
      END,
      CASE
        WHEN t.status = 'completed' AND t.tileset_uri IS NOT NULL THEN 'completed'::task_run_status
        WHEN t.status = 'completed' THEN 'running'::task_run_status
        WHEN t.status IN ('failed', 'failed_to_submit') THEN 'failed'::task_run_status
        WHEN t.status IN ('submitted', 'running') THEN 'running'::task_run_status
        ELSE 'queued'::task_run_status
      END,
      CASE
        WHEN t.status = 'completed' AND t.tileset_uri IS NULL THEN 'publishing'::task_run_stage
        WHEN t.status = 'running' THEN 'solving'::task_run_stage
        ELSE NULL
      END,
      jsonb_build_object(
        'schema_version', 1,
        'lineage', 'legacy_incomplete',
        'task', jsonb_build_object(
          'name', t.name,
          'description', t.description,
          'resolution', t.resolution,
          'resampling', t.resampling,
          'variant', t.variant
        )
      ),
      md5(t.task_id::text || ':legacy') || md5(t.task_id::text || ':legacy:2'),
      jsonb_build_object(
        'type', 'regular_grid',
        'version', 'legacy_unversioned',
        'crs', 'EPSG:3005',
        'resolution', t.resolution,
        'lineage', 'incomplete'
      ),
      jsonb_build_object('solver', 'retired_legacy_solver', 'lineage', 'legacy_incomplete'),
      'legacy_unversioned',
      CASE WHEN t.output_uri IS NOT NULL THEN 'unknown_success' ELSE NULL END,
      t.prefect_flow_run_id,
      t.prefect_deployment_id,
      t.status_message,
      CASE WHEN t.status IN ('running', 'completed', 'failed') THEN COALESCE(t.updated_at, t.created_at) ELSE NULL END,
      CASE WHEN t.status = 'completed' AND t.tileset_uri IS NOT NULL THEN COALESCE(t.updated_at, t.created_at) ELSE NULL END,
      CASE WHEN t.status IN ('failed', 'failed_to_submit') THEN COALESCE(t.updated_at, t.created_at) ELSE NULL END,
      t.created_at,
      t.updated_at,
      t.created_by,
      t.updated_by
    FROM task t
    CROSS JOIN analytical_source source
    WHERE t.status <> 'draft'
      AND source.name = 'legacy_species_atlas'
      AND source.version = 'legacy_unversioned';

    INSERT INTO artifact (task_run_id, type, status, uri, content_type, checksum, lineage, completed_at, created_at, created_by)
    SELECT tr.task_run_id, 'raw_solver_result', 'ready', t.output_uri, 'application/octet-stream',
      'legacy-unverified', '{"lineage":"legacy_incomplete"}'::jsonb,
      COALESCE(t.updated_at, t.created_at), COALESCE(t.updated_at, t.created_at), t.created_by
    FROM task t
    JOIN task_run tr ON tr.task_id = t.task_id
    WHERE t.output_uri IS NOT NULL;

    INSERT INTO artifact (task_run_id, type, status, uri, content_type, checksum, lineage, completed_at, created_at, created_by)
    SELECT tr.task_run_id, 'pmtiles', 'ready', t.tileset_uri, 'application/vnd.pmtiles',
      'legacy-unverified', '{"lineage":"legacy_incomplete"}'::jsonb,
      COALESCE(t.updated_at, t.created_at), COALESCE(t.updated_at, t.created_at), t.created_by
    FROM task t
    JOIN task_run tr ON tr.task_id = t.task_id
    WHERE t.tileset_uri IS NOT NULL;
  `);
}

/**
 * Remove task-run architecture tables and enum types.
 *
 * @param {Knex} knex Database connection.
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;
    DROP TRIGGER IF EXISTS trg_notify_task_permission_scope ON task_permission;
    DROP TRIGGER IF EXISTS trg_notify_task_profile_scope ON task_profile;
    DROP FUNCTION IF EXISTS tr_notify_profile_scope();
    DROP TRIGGER IF EXISTS trg_artifact_touch_task_run ON artifact;
    DROP FUNCTION IF EXISTS tr_artifact_touch_task_run();
    DROP TRIGGER IF EXISTS trg_notify_task_run ON task_run;
    DROP FUNCTION IF EXISTS tr_notify_task_run();
    DROP TRIGGER IF EXISTS trg_analytical_source_immutable ON analytical_source;
    DROP FUNCTION IF EXISTS tr_analytical_source_immutable();
    DROP TRIGGER IF EXISTS trg_audit_artifact ON artifact;
    DROP TRIGGER IF EXISTS trg_journal_artifact ON artifact;
    DROP TRIGGER IF EXISTS trg_audit_task_run ON task_run;
    DROP TRIGGER IF EXISTS trg_journal_task_run ON task_run;
    DROP TRIGGER IF EXISTS trg_task_run_immutable ON task_run;
    DROP FUNCTION IF EXISTS tr_task_run_immutable();
    DROP TABLE IF EXISTS artifact;
    DROP TABLE IF EXISTS task_run;
    DROP TABLE IF EXISTS analytical_source;
    DROP TYPE IF EXISTS artifact_type;
    DROP TYPE IF EXISTS artifact_status;
    DROP TYPE IF EXISTS task_run_stage;
    DROP TYPE IF EXISTS task_run_strategy;
    DROP TYPE IF EXISTS task_run_status;
  `);
}
