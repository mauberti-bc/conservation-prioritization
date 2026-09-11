import { Knex } from 'knex';

/**
 * Add the solver-specific Dask-to-global-cut artifact type.
 *
 * @param {Knex} knex Knex connection used to execute the migration.
 * @returns {Promise<void>} Resolves when the operation completes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'grid_cut_tiles';
  `);
}

/**
 * PostgreSQL enum values remain for historical artifact readability.
 *
 * @param {Knex} _knex Unused Knex connection; this rollback preserves the existing schema.
 * @returns {Promise<void>} Resolves without changing the schema; the migration is intentionally retained.
 */
export async function down(_knex: Knex): Promise<void> {}
