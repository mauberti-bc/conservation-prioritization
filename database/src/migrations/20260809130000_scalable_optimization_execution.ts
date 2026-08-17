import { Knex } from 'knex';

/**
 * Add formulation-aware routing, admission measurements, and scalable artifacts.
 *
 * @param {Knex} knex Database connection.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    CREATE TYPE task_run_execution_method AS ENUM (
      'distributed_local',
      'distributed_top_k',
      'sparse_milp',
      'hierarchical_iterative_refinement',
      'unsupported'
    );

    ALTER TYPE task_run_stage ADD VALUE IF NOT EXISTS 'estimating' BEFORE 'preparing';
    ALTER TYPE task_run_stage ADD VALUE IF NOT EXISTS 'counting' BEFORE 'preparing';
    ALTER TYPE task_run_stage ADD VALUE IF NOT EXISTS 'admitting' AFTER 'preparing';
    ALTER TYPE task_run_stage ADD VALUE IF NOT EXISTS 'selecting' AFTER 'admitting';
    ALTER TYPE task_run_stage ADD VALUE IF NOT EXISTS 'exporting' AFTER 'materializing';

    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'planning_unit_inventory';
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'planning_unit_records';
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'candidate_runs';
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'canonical_export';

    ALTER TABLE task_run
      ADD COLUMN execution_method task_run_execution_method,
      ADD COLUMN preliminary_estimate jsonb,
      ADD COLUMN admission_outcome jsonb,
      ADD COLUMN planning_unit_count bigint,
      ADD COLUMN feature_nonzero_count bigint,
      ADD COLUMN connectivity_edge_count bigint;

    UPDATE task_run
    SET execution_method = CASE
      WHEN strategy = 'approximate' THEN 'unsupported'::task_run_execution_method
      WHEN input_snapshot->>'lineage' = 'legacy_incomplete' THEN 'sparse_milp'::task_run_execution_method
      ELSE 'sparse_milp'::task_run_execution_method
    END;

    ALTER TABLE task_run
      ALTER COLUMN execution_method SET NOT NULL,
      ADD CONSTRAINT task_run_planning_unit_count_ck CHECK (planning_unit_count IS NULL OR planning_unit_count >= 0),
      ADD CONSTRAINT task_run_feature_nonzero_count_ck CHECK (feature_nonzero_count IS NULL OR feature_nonzero_count >= 0),
      ADD CONSTRAINT task_run_connectivity_edge_count_ck CHECK (connectivity_edge_count IS NULL OR connectivity_edge_count >= 0);

    CREATE INDEX task_run_execution_admission_idx
      ON task_run (execution_method, status, planning_unit_count);

    CREATE OR REPLACE FUNCTION tr_task_run_immutable() RETURNS trigger AS $$
    BEGIN
      IF OLD.task_id IS DISTINCT FROM NEW.task_id
        OR OLD.analytical_source_id IS DISTINCT FROM NEW.analytical_source_id
        OR OLD.strategy IS DISTINCT FROM NEW.strategy
        OR OLD.execution_method IS DISTINCT FROM NEW.execution_method
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
  `);
}

/**
 * Remove scalable execution metadata while retaining enum values that PostgreSQL
 * cannot safely remove in place.
 *
 * @param {Knex} knex Database connection.
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    DROP INDEX IF EXISTS task_run_execution_admission_idx;
    ALTER TABLE task_run
      DROP CONSTRAINT IF EXISTS task_run_planning_unit_count_ck,
      DROP CONSTRAINT IF EXISTS task_run_feature_nonzero_count_ck,
      DROP CONSTRAINT IF EXISTS task_run_connectivity_edge_count_ck,
      DROP COLUMN IF EXISTS execution_method,
      DROP COLUMN IF EXISTS preliminary_estimate,
      DROP COLUMN IF EXISTS admission_outcome,
      DROP COLUMN IF EXISTS planning_unit_count,
      DROP COLUMN IF EXISTS feature_nonzero_count,
      DROP COLUMN IF EXISTS connectivity_edge_count;

    DROP TYPE IF EXISTS task_run_execution_method;

    CREATE OR REPLACE FUNCTION tr_task_run_immutable() RETURNS trigger AS $$
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
  `);
}
