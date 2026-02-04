import { Knex } from 'knex';

/**
 * Add task status tracking and Prefect flow metadata to tasks.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    DO $$ BEGIN
      CREATE TYPE task_status AS ENUM ('pending', 'submitted', 'running', 'completed', 'failed', 'failed_to_submit');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE task
      ADD COLUMN status task_status NOT NULL DEFAULT 'pending',
      ADD COLUMN status_message varchar(500),
      ADD COLUMN prefect_flow_run_id uuid,
      ADD COLUMN prefect_deployment_id uuid;

    COMMENT ON COLUMN task.status IS 'Execution status for the task lifecycle.';
    COMMENT ON COLUMN task.status_message IS 'Optional status message for diagnostics.';
    COMMENT ON COLUMN task.prefect_flow_run_id IS 'Prefect flow run ID associated with the task.';
    COMMENT ON COLUMN task.prefect_deployment_id IS 'Prefect deployment ID used to launch the task.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    ALTER TABLE task
      DROP COLUMN IF EXISTS status,
      DROP COLUMN IF EXISTS status_message,
      DROP COLUMN IF EXISTS prefect_flow_run_id,
      DROP COLUMN IF EXISTS prefect_deployment_id;

    DROP TYPE IF EXISTS task_status;
  `);
}
