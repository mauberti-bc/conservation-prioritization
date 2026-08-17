import { Knex } from 'knex';

/** Add the solver-specific Dask-to-global-cut artifact type. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'grid_cut_tiles';
  `);
}

/** PostgreSQL enum values remain for historical artifact readability. */
export async function down(_knex: Knex): Promise<void> {}
