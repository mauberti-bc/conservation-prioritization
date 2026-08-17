import { Knex } from 'knex';

/**
 * Add product task types, immutable run method identity, and normalized run solutions.
 *
 * @param {Knex} knex Database connection.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    CREATE TYPE task_type AS ENUM ('prioritization', 'optimization', 'portfolio');
    CREATE TYPE solution_role AS ENUM ('reference', 'alternative');

    ALTER TABLE task
      ADD COLUMN type task_type NOT NULL DEFAULT 'prioritization';

    ALTER TABLE task_run
      ADD COLUMN task_type task_type,
      ADD COLUMN execution_method_version varchar(100);

    UPDATE task_run tr
    SET task_type = COALESCE(
          (SELECT t.type FROM task t WHERE t.task_id = tr.task_id LIMIT 1),
          'prioritization'::task_type
        ),
        execution_method_version = CASE tr.execution_method
          WHEN 'distributed_local' THEN 'distributed-local-v1'
          WHEN 'distributed_top_k' THEN 'distributed-top-k-v1'
          WHEN 'sparse_milp' THEN 'highs-csr-v2'
          WHEN 'hierarchical_iterative_refinement' THEN 'hierarchical-iterative-refinement-v1'
          ELSE 'unsupported-v1'
        END;

    ALTER TABLE task_run
      ALTER COLUMN task_type SET NOT NULL,
      ALTER COLUMN execution_method_version SET NOT NULL;

    CREATE TABLE task_run_solution (
      task_run_solution_id uuid DEFAULT gen_random_uuid(),
      task_run_id uuid NOT NULL,
      solution_index integer NOT NULL,
      role solution_role NOT NULL,
      status varchar(100) NOT NULL,
      objective_value numeric,
      resource_value numeric,
      selected_planning_unit_count bigint,
      optimality_gap numeric,
      quality_delta_from_reference numeric,
      diversity_from_reference numeric,
      solver_name varchar(100),
      solver_version varchar(100),
      runtime_seconds numeric,
      metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz(6) DEFAULT now() NOT NULL,
      created_by uuid,
      updated_at timestamptz(6),
      updated_by uuid,
      CONSTRAINT task_run_solution_pk PRIMARY KEY (task_run_solution_id),
      CONSTRAINT task_run_solution_run_fk FOREIGN KEY (task_run_id) REFERENCES task_run(task_run_id) ON DELETE CASCADE,
      CONSTRAINT task_run_solution_index_uk UNIQUE (task_run_id, solution_index),
      CONSTRAINT task_run_solution_run_identity_uk UNIQUE (task_run_id, task_run_solution_id),
      CONSTRAINT task_run_solution_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id),
      CONSTRAINT task_run_solution_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id),
      CONSTRAINT task_run_solution_count_ck CHECK (selected_planning_unit_count IS NULL OR selected_planning_unit_count >= 0)
    );

    CREATE UNIQUE INDEX task_run_solution_reference_uk
      ON task_run_solution (task_run_id)
      WHERE role = 'reference';

    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'solution_set';

    ALTER TABLE artifact
      ADD COLUMN task_run_solution_id uuid,
      ADD CONSTRAINT artifact_solution_scope_ck
        CHECK (task_run_solution_id IS NULL OR task_run_id IS NOT NULL),
      ADD CONSTRAINT artifact_solution_fk
        FOREIGN KEY (task_run_id, task_run_solution_id)
        REFERENCES task_run_solution(task_run_id, task_run_solution_id)
        ON DELETE CASCADE;

    DROP INDEX artifact_run_type_uk;
    CREATE UNIQUE INDEX artifact_run_type_uk
      ON artifact (task_run_id, type)
      WHERE task_run_id IS NOT NULL AND task_run_solution_id IS NULL;
    CREATE UNIQUE INDEX artifact_solution_type_uk
      ON artifact (task_run_solution_id, type)
      WHERE task_run_solution_id IS NOT NULL;

    CREATE OR REPLACE FUNCTION tr_task_run_immutable() RETURNS trigger AS $$
    BEGIN
      IF OLD.task_id IS DISTINCT FROM NEW.task_id
        OR OLD.task_type IS DISTINCT FROM NEW.task_type
        OR OLD.analytical_source_id IS DISTINCT FROM NEW.analytical_source_id
        OR OLD.strategy IS DISTINCT FROM NEW.strategy
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

    CREATE FUNCTION tr_solution_touch_task_run() RETURNS trigger AS $$
    BEGIN
      UPDATE task_run
      SET revision = revision + 1, updated_at = now()
      WHERE task_run_id = COALESCE(NEW.task_run_id, OLD.task_run_id);
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_solution_touch_task_run
      AFTER INSERT OR UPDATE OR DELETE ON task_run_solution
      FOR EACH ROW EXECUTE FUNCTION tr_solution_touch_task_run();

    CREATE TRIGGER trg_journal_task_run_solution
      BEFORE INSERT OR UPDATE OR DELETE ON task_run_solution
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    CREATE TRIGGER trg_audit_task_run_solution
      AFTER INSERT OR UPDATE OR DELETE ON task_run_solution
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();
  `);
}

/**
 * Remove product task type and solution schema while retaining additive enum values.
 *
 * @param {Knex} knex Database connection.
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    DROP TRIGGER IF EXISTS trg_audit_task_run_solution ON task_run_solution;
    DROP TRIGGER IF EXISTS trg_journal_task_run_solution ON task_run_solution;
    DROP TRIGGER IF EXISTS trg_solution_touch_task_run ON task_run_solution;
    DROP FUNCTION IF EXISTS tr_solution_touch_task_run();

    DROP INDEX IF EXISTS artifact_solution_type_uk;
    DROP INDEX IF EXISTS artifact_run_type_uk;
    ALTER TABLE artifact
      DROP CONSTRAINT IF EXISTS artifact_solution_fk,
      DROP CONSTRAINT IF EXISTS artifact_solution_scope_ck,
      DROP COLUMN IF EXISTS task_run_solution_id;
    CREATE UNIQUE INDEX artifact_run_type_uk ON artifact (task_run_id, type) WHERE task_run_id IS NOT NULL;

    DROP TABLE IF EXISTS task_run_solution;

    ALTER TABLE task_run
      DROP COLUMN IF EXISTS task_type,
      DROP COLUMN IF EXISTS execution_method_version;
    ALTER TABLE task DROP COLUMN IF EXISTS type;

    DROP TYPE IF EXISTS solution_role;
    DROP TYPE IF EXISTS task_type;
  `);
}
