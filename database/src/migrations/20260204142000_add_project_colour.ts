import { Knex } from 'knex';

/**
 * Add colour column to project table.
 *
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;
    ALTER TABLE project
    ADD COLUMN IF NOT EXISTS colour varchar(7) NOT NULL DEFAULT '#1a5a96';
  `);
}

/**
 * Remove colour column from project table.
 *
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;
    ALTER TABLE project
    DROP COLUMN IF EXISTS colour;
  `);
}
