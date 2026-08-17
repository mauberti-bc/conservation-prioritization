import { Knex } from 'knex';

/** Replace superseded product, execution, artifact, and solution contracts. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;

    DELETE FROM artifact;
    DELETE FROM task_run_solution;
    DELETE FROM task_run;
    DELETE FROM task WHERE variant = 'approximate';
    DELETE FROM task WHERE type::text <> 'optimization';
    UPDATE task
    SET status = 'draft',
        status_message = NULL,
        prefect_flow_run_id = NULL,
        prefect_deployment_id = NULL,
        tileset_uri = NULL,
        output_uri = NULL;

    DROP TABLE task_layer_constraint;
    DROP TABLE task_layer;
    DROP TYPE task_layer_constraint_type;
    DROP TYPE task_layer_mode;
    DROP TABLE task_geometry;
    DROP TABLE geometry;

    CREATE TYPE task_type_standard AS ENUM ('optimization');
    ALTER TABLE task ALTER COLUMN type DROP DEFAULT;
    ALTER TABLE task
      ALTER COLUMN type TYPE task_type_standard
      USING type::text::task_type_standard;
    ALTER TABLE task_run
      ALTER COLUMN task_type TYPE task_type_standard
      USING task_type::text::task_type_standard;
    DROP TYPE task_type;
    ALTER TYPE task_type_standard RENAME TO task_type;
    ALTER TABLE task ALTER COLUMN type SET DEFAULT 'optimization'::task_type;

    CREATE TYPE task_run_execution_method_standard AS ENUM (
      'compiled_optimization'
    );
    DELETE FROM task_run
    WHERE execution_method::text <> 'compiled_optimization';
    ALTER TABLE task_run
      ALTER COLUMN execution_method TYPE task_run_execution_method_standard
      USING execution_method::text::task_run_execution_method_standard;
    DROP TYPE task_run_execution_method;
    ALTER TYPE task_run_execution_method_standard
      RENAME TO task_run_execution_method;

    ALTER TABLE task_run DROP COLUMN strategy;
    DROP TYPE task_run_strategy;
    ALTER TABLE task DROP COLUMN variant;

    ALTER TABLE task_run
      RENAME COLUMN boundary_edge_count TO neighbor_edge_count;
    ALTER TABLE task_run
      RENAME CONSTRAINT task_run_boundary_edge_count_ck
      TO task_run_neighbor_edge_count_ck;
    ALTER TABLE task_run DROP COLUMN connectivity_edge_count;

    CREATE OR REPLACE FUNCTION tr_task_run_immutable() RETURNS trigger AS $$
    BEGIN
      IF OLD.task_id IS DISTINCT FROM NEW.task_id
        OR OLD.task_type IS DISTINCT FROM NEW.task_type
        OR OLD.analytical_source_id IS DISTINCT FROM NEW.analytical_source_id
        OR OLD.execution_method IS DISTINCT FROM NEW.execution_method
        OR OLD.execution_method_version IS DISTINCT FROM NEW.execution_method_version
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

    UPDATE task_run SET stage = NULL WHERE stage::text = 'prioritizing';
    CREATE TYPE task_run_stage_standard AS ENUM (
      'counting',
      'preparing',
      'admitting',
      'compiling',
      'solving',
      'materializing',
      'exporting',
      'publishing'
    );
    ALTER TABLE task_run
      ALTER COLUMN stage TYPE task_run_stage_standard
      USING stage::text::task_run_stage_standard;
    DROP TYPE task_run_stage;
    ALTER TYPE task_run_stage_standard RENAME TO task_run_stage;

    DROP INDEX task_run_solution_reference_uk;
    CREATE TYPE solution_role_standard AS ENUM ('reference');
    ALTER TABLE task_run_solution
      ALTER COLUMN role TYPE solution_role_standard
      USING role::text::solution_role_standard;
    DROP TYPE solution_role;
    ALTER TYPE solution_role_standard RENAME TO solution_role;
    CREATE UNIQUE INDEX task_run_solution_reference_uk
      ON task_run_solution (task_run_id)
      WHERE role = 'reference';
    ALTER TABLE task_run_solution
      DROP COLUMN quality_delta_from_reference,
      DROP COLUMN diversity_from_reference;

    DROP INDEX artifact_solution_type_uk;
    DROP INDEX artifact_run_type_uk;
    ALTER TABLE artifact
      DROP CONSTRAINT artifact_solution_scope_ck,
      DROP CONSTRAINT artifact_solution_fk,
      DROP COLUMN task_run_solution_id;
    CREATE UNIQUE INDEX artifact_run_type_uk
      ON artifact (task_run_id, type)
      WHERE task_run_id IS NOT NULL;

    CREATE TYPE artifact_type_standard AS ENUM (
      'planning_unit_inventory',
      'compiled_model',
      'raw_solver_result',
      'canonical_result',
      'canonical_export',
      'pmtiles'
    );
    ALTER TABLE artifact
      ALTER COLUMN type TYPE artifact_type_standard
      USING type::text::artifact_type_standard;
    DROP TYPE artifact_type;
    ALTER TYPE artifact_type_standard RENAME TO artifact_type;
  `);
}

/** The hard refactor is intentionally irreversible. */
export async function down(_knex: Knex): Promise<void> {
  return;
}
