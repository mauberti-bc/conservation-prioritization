import { Knex } from 'knex';

/**
 * Represent proven infeasibility and outputs skipped because no solution exists.
 *
 * @param {Knex} knex Connection used to extend lifecycle enums.
 * @returns {Promise<void>} Resolves when the new enum values are available.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;
    ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'infeasible';
    ALTER TYPE task_run_status ADD VALUE IF NOT EXISTS 'infeasible';
    ALTER TYPE artifact_status ADD VALUE IF NOT EXISTS 'skipped';
  `);
}

/**
 * Preserve enum values that may be referenced by existing runs.
 *
 * @param {Knex} _knex Unused connection because enum values are retained.
 * @returns {Promise<void>} Resolves without changing persisted outcomes.
 */
export async function down(_knex: Knex): Promise<void> {
  // PostgreSQL enum values cannot be dropped without recreating their types.
}
