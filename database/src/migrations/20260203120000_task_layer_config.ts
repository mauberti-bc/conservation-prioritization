import { Knex } from 'knex';

/**
 * Add configured task-layer fields and typed constraints for task layers.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    DO $$ BEGIN
      CREATE TYPE task_layer_mode AS ENUM ('flexible', 'locked-in', 'locked-out');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE task_layer_constraint_type AS ENUM ('percent', 'unit');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE task_layer
      ADD COLUMN mode task_layer_mode NOT NULL DEFAULT 'flexible',
      ADD COLUMN importance numeric,
      ADD COLUMN threshold numeric;

    COMMENT ON COLUMN task_layer.mode IS 'Configured mode for the task layer (flexible, locked-in, locked-out).';
    COMMENT ON COLUMN task_layer.importance IS 'Relative importance when mode is flexible.';
    COMMENT ON COLUMN task_layer.threshold IS 'Threshold used when mode is locked-in or locked-out.';

    ALTER TABLE task_layer_constraint
      ADD COLUMN type task_layer_constraint_type NOT NULL DEFAULT 'unit',
      ADD COLUMN min numeric,
      ADD COLUMN max numeric;

    COMMENT ON COLUMN task_layer_constraint.type IS 'Constraint type (percent or unit).';
    COMMENT ON COLUMN task_layer_constraint.min IS 'Minimum constraint value.';
    COMMENT ON COLUMN task_layer_constraint.max IS 'Maximum constraint value.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    ALTER TABLE task_layer_constraint
      DROP COLUMN IF EXISTS type,
      DROP COLUMN IF EXISTS min,
      DROP COLUMN IF EXISTS max;

    ALTER TABLE task_layer
      DROP COLUMN IF EXISTS mode,
      DROP COLUMN IF EXISTS importance,
      DROP COLUMN IF EXISTS threshold;

    DROP TYPE IF EXISTS task_layer_constraint_type;
    DROP TYPE IF EXISTS task_layer_mode;
  `);
}
