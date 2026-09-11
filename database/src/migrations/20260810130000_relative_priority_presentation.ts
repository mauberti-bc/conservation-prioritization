import { Knex } from 'knex';

/**
 * Add the durable scenario-relative display-distribution artifact role.
 *
 * @param {Knex} knex Knex connection used to execute the migration.
 * @returns {Promise<void>} Resolves when the operation completes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'relative_priority_distribution';
  `);
}

/**
 * Retain the PostgreSQL enum value because removing it in place is unsafe.
 *
 * @param {Knex} _knex Unused Knex connection; this rollback preserves the existing schema.
 * @returns {Promise<void>} Resolves without changing the schema; the migration is intentionally retained.
 */
export async function down(_knex: Knex): Promise<void> {
  // PostgreSQL enum values are intentionally retained on rollback.
}
