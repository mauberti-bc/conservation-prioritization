import { Knex } from 'knex';

/** Persist bounded-work solver heartbeats for user-visible progress. */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('task_run', (table) => {
    table.jsonb('progress').nullable();
  });
}

/** Remove the progress document. */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('task_run', (table) => {
    table.dropColumn('progress');
  });
}
