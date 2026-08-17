import { Knex } from 'knex';

/**
 * Persist the exact production solver identity used by a task run.
 *
 * @param {Knex} knex Database connection.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;
    ALTER TABLE task_run
      ADD COLUMN solver_name varchar(100),
      ADD COLUMN solver_version varchar(100);
  `);
}

/**
 * Remove persisted production solver identity.
 *
 * @param {Knex} knex Database connection.
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;
    ALTER TABLE task_run
      DROP COLUMN IF EXISTS solver_name,
      DROP COLUMN IF EXISTS solver_version;
  `);
}
