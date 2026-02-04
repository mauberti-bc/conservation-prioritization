import { Knex } from 'knex';

/**
 * Add draft status to task_status enum.
 *
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
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
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(_knex: Knex): Promise<void> {
  // Postgres enums cannot easily drop values without recreating the type.
}
