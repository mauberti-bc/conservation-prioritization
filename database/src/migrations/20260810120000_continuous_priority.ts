import { Knex } from 'knex';

/**
 * Add continuous-priority lifecycle and durable artifact roles.
 *
 * @param {Knex} knex Database connection.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    ALTER TYPE task_run_stage ADD VALUE IF NOT EXISTS 'prioritizing' AFTER 'solving';
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'priority_schedule';
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'reference_support_model';
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'incremental_priority_checkpoint';
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'pmtiles_decision';
  `);
}

/**
 * Retain PostgreSQL enum values because removing them in place is unsafe.
 *
 * @param {Knex} _knex Database connection.
 * @returns {Promise<void>}
 */
export async function down(_knex: Knex): Promise<void> {
  // PostgreSQL enum values are intentionally retained on rollback.
}
