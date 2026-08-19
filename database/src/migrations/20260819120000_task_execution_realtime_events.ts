import { Knex } from 'knex';

/** Notify clients only when task-level execution state changes. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    CREATE FUNCTION tr_notify_task_execution() RETURNS trigger AS $$
    BEGIN
      IF OLD.status IS DISTINCT FROM NEW.status
        OR OLD.status_message IS DISTINCT FROM NEW.status_message
        OR OLD.tileset_uri IS DISTINCT FROM NEW.tileset_uri
        OR OLD.output_uri IS DISTINCT FROM NEW.output_uri THEN
        PERFORM pg_notify(
          'conservation_realtime',
          json_build_object(
            'type', 'task.updated',
            'task_id', NEW.task_id,
            'status', NEW.status,
            'updated_at', COALESCE(NEW.updated_at, NEW.created_at, now())
          )::text
        );
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_notify_task_execution
      AFTER UPDATE OF status, status_message, tileset_uri, output_uri ON task
      FOR EACH ROW EXECUTE FUNCTION tr_notify_task_execution();
  `);
}

/** Remove task-level realtime notifications. */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    DROP TRIGGER IF EXISTS trg_notify_task_execution ON task;
    DROP FUNCTION IF EXISTS tr_notify_task_execution();
  `);
}
