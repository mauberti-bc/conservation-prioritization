import { Knex } from 'knex';

/**
 * Add the exact reduced-portfolio recovery boundary.
 *
 * @param {Knex} knex Database connection.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'portfolio_reduction';
  `);
}

/**
 * Retain the additive enum value because PostgreSQL enum values are not safely removed in place.
 *
 * @param {Knex} _knex Database connection.
 * @returns {Promise<void>}
 */
export async function down(_knex: Knex): Promise<void> {}
