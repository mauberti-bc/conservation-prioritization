import { Knex } from 'knex';

/** Add boundary-specific structural metrics without reusing connectivity terminology. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;
    ALTER TABLE task_run
      ADD COLUMN boundary_edge_count bigint,
      ADD CONSTRAINT task_run_boundary_edge_count_ck
        CHECK (boundary_edge_count IS NULL OR boundary_edge_count >= 0);
  `);
}

/** Remove boundary-specific structural metrics. */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;
    ALTER TABLE task_run
      DROP CONSTRAINT IF EXISTS task_run_boundary_edge_count_ck,
      DROP COLUMN IF EXISTS boundary_edge_count;
  `);
}
