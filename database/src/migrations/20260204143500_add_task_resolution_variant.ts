import { Knex } from 'knex';

/**
 * Add resolution/resampling/variant columns to task table.
 *
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;
    ALTER TABLE task
      ADD COLUMN IF NOT EXISTS resolution integer,
      ADD COLUMN IF NOT EXISTS resampling varchar(10),
      ADD COLUMN IF NOT EXISTS variant varchar(20);
  `);
}

/**
 * Remove resolution/resampling/variant columns from task table.
 *
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;
    ALTER TABLE task
      DROP COLUMN IF EXISTS resolution,
      DROP COLUMN IF EXISTS resampling,
      DROP COLUMN IF EXISTS variant;
  `);
}
