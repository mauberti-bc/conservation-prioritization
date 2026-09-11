import { Knex } from 'knex';

/**
 * Persist bounded-work solver heartbeats for user-visible progress.
 *
 * @param {Knex} knex Knex connection used to execute the migration.
 * @returns {Promise<void>} Resolves when the operation completes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('task_run', (table) => {
    table.jsonb('progress').nullable();
  });
}

/**
 * Remove the progress document.
 *
 * @param {Knex} knex Knex connection used to execute the migration.
 * @returns {Promise<void>} Resolves when the operation completes.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('task_run', (table) => {
    table.dropColumn('progress');
  });
}
