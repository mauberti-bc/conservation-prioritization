import { Knex } from 'knex';

/**
 * Add specialized boundary execution methods without changing legacy values.
 *
 * @param {Knex} knex Knex connection used to execute the migration.
 * @returns {Promise<void>} Resolves when the operation completes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TYPE task_run_execution_method ADD VALUE IF NOT EXISTS 'exact_grid_cut';
    ALTER TYPE task_run_execution_method ADD VALUE IF NOT EXISTS 'lagrangian_grid_cut';
  `);
}

/**
 * PostgreSQL enum values remain for historical run readability.
 *
 * @param {Knex} _knex Unused Knex connection; this rollback preserves the existing schema.
 * @returns {Promise<void>} Resolves without changing the schema; the migration is intentionally retained.
 */
export async function down(_knex: Knex): Promise<void> {}
