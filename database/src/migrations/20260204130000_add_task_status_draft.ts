import { Knex } from 'knex';

/**
 * Add draft status to task_status enum.
 *
 * @param {Knex} knex Knex connection used to execute the migration.
 * @returns {Promise<void>} Resolves when the operation completes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;
    ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'draft';
  `);
}

/**
 * Remove draft status from task_status enum.
 *
 * @param {Knex} _knex Unused Knex connection; this rollback preserves the existing schema.
 * @returns {Promise<void>} Resolves without changing the schema; the migration is intentionally retained.
 */
export async function down(_knex: Knex): Promise<void> {
  // Postgres enums cannot easily drop values without recreating the type.
}
