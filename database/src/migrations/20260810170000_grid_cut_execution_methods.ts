import { Knex } from 'knex';

/** Add specialized boundary execution methods without changing legacy values. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TYPE task_run_execution_method ADD VALUE IF NOT EXISTS 'exact_grid_cut';
    ALTER TYPE task_run_execution_method ADD VALUE IF NOT EXISTS 'lagrangian_grid_cut';
  `);
}

/** PostgreSQL enum values remain for historical run readability. */
export async function down(_knex: Knex): Promise<void> {}
