import { Knex } from 'knex';

/** Add the durable scenario-relative display-distribution artifact role. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'relative_priority_distribution';
  `);
}

/** Retain the PostgreSQL enum value because removing it in place is unsafe. */
export async function down(_knex: Knex): Promise<void> {
  // PostgreSQL enum values are intentionally retained on rollback.
}
