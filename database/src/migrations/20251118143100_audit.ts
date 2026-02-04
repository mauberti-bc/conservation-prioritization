import { Knex } from 'knex';
import { IDENTITY_SOURCE } from '../constants/profile';

/**
 * Create audit log structures, trigger functions, seed system profile, and attach triggers.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    ----------------------------------------------------------------------------------------
    -- Audit Log Table
    ----------------------------------------------------------------------------------------
    CREATE TABLE audit_log (
      audit_log_id       uuid            DEFAULT gen_random_uuid(),
      profile_id         uuid            NOT NULL,
      created_at         timestamptz(6)  DEFAULT now() NOT NULL,
      table_name         varchar(200)    NOT NULL,
      operation          varchar(20)     NOT NULL,
      before_value       json,
      after_value        json,
      CONSTRAINT audit_log_pk PRIMARY KEY (audit_log_id)
    );

    COMMENT ON TABLE audit_log IS 'Holds record level audit log data for the entire database.';
    COMMENT ON COLUMN audit_log.audit_log_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN audit_log.profile_id IS 'The system user id affecting the data change.';
    COMMENT ON COLUMN audit_log.created_at IS 'The date and time of record creation.';
    COMMENT ON COLUMN audit_log.table_name IS 'The table name of the data record.';
    COMMENT ON COLUMN audit_log.operation IS 'The operation that affected the data change (ie. INSERT, UPDATE, DELETE, TRUNCATE).';
    COMMENT ON COLUMN audit_log.before_value IS 'The JSON representation of the before value of the record.';
    COMMENT ON COLUMN audit_log.after_value IS 'The JSON representation of the after value of the record.';

    ----------------------------------------------------------------------------------------
    -- Audit Trigger Function
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION tr_audit_trigger() RETURNS trigger
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET client_min_messages = warning
    AS
    $$
    DECLARE
      _profile_id profile.profile_id%TYPE;
    BEGIN
      -- Read profile context from session settings
      _profile_id := NULLIF(current_setting('app.profile_id', true), '')::uuid;

      -- Fallback: if profile_id not set, use DATABASE user
      IF _profile_id IS NULL THEN
        SELECT profile_id INTO _profile_id
        FROM profile
        WHERE identity_source = '${IDENTITY_SOURCE.DATABASE}'
        LIMIT 1;
      END IF;

      IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log(
          profile_id,
          table_name,
          operation,
          after_value
        ) VALUES (
          _profile_id,
          TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
          TG_OP,
          row_to_json(NEW)
        );
        RETURN NEW;

      ELSIF TG_OP = 'UPDATE' THEN
        -- Don't log the update if only audit columns changed
        IF to_jsonb(NEW) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by'
          IS NOT DISTINCT FROM to_jsonb(OLD) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by' THEN
          RETURN NEW;
        END IF;

        INSERT INTO audit_log(
          profile_id,
          table_name,
          operation,
          before_value,
          after_value
        ) VALUES (
          _profile_id,
          TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
          TG_OP,
          row_to_json(OLD),
          row_to_json(NEW)
        );
        RETURN NEW;

      ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log(
          profile_id,
          table_name,
          operation,
          before_value
        ) VALUES (
          _profile_id,
          TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
          TG_OP,
          row_to_json(OLD)
        );
        RETURN OLD;
      END IF;

      RETURN NULL;
    END;
    $$;

    ----------------------------------------------------------------------------------------
    -- Journal Trigger Function
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION tr_journal_trigger() RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS
    $$
    DECLARE
      _profile_id profile.profile_id%TYPE;
    BEGIN
      -- Read profile context from session settings
      _profile_id := NULLIF(current_setting('app.profile_id', true), '')::uuid;

      -- Fallback: if profile_id not set, use DATABASE user
      IF _profile_id IS NULL THEN
        SELECT profile_id INTO _profile_id
        FROM profile
        WHERE identity_source = '${IDENTITY_SOURCE.DATABASE}'
        LIMIT 1;
      END IF;

      IF TG_OP = 'INSERT' THEN
        NEW.created_at := COALESCE(NEW.created_at, now());
        NEW.created_by := COALESCE(NEW.created_by, _profile_id);
        NEW.updated_at := COALESCE(NEW.updated_at, NEW.created_at);
        NEW.updated_by := COALESCE(NEW.updated_by, NEW.created_by);
        RETURN NEW;

      ELSIF TG_OP = 'UPDATE' THEN
        -- Don't update if only audit columns changed
        IF to_jsonb(NEW) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by'
          IS NOT DISTINCT FROM to_jsonb(OLD) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by' THEN
          RETURN OLD;
        END IF;

        NEW.updated_at := now();
        NEW.updated_by := COALESCE(NEW.updated_by, _profile_id);
        NEW.created_by := OLD.created_by;
        NEW.created_at := OLD.created_at;
        RETURN NEW;

      ELSIF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $$;

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to tables
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_journal_role ON role;
    CREATE TRIGGER trg_journal_role
      BEFORE INSERT OR UPDATE OR DELETE ON role
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_role ON role;
    CREATE TRIGGER trg_audit_role
      AFTER INSERT OR UPDATE OR DELETE ON role
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_profile ON profile;
    CREATE TRIGGER trg_journal_profile
      BEFORE INSERT OR UPDATE OR DELETE ON profile
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_profile ON profile;
    CREATE TRIGGER trg_audit_profile
      AFTER INSERT OR UPDATE OR DELETE ON profile
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project ON project;
    CREATE TRIGGER trg_journal_project
      BEFORE INSERT OR UPDATE OR DELETE ON project
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_project ON project;
    CREATE TRIGGER trg_audit_project
      AFTER INSERT OR UPDATE OR DELETE ON project
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project_permission ON project_permission;
    CREATE TRIGGER trg_journal_project_permission
      BEFORE INSERT OR UPDATE OR DELETE ON project_permission
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_project_permission ON project_permission;
    CREATE TRIGGER trg_audit_project_permission
      AFTER INSERT OR UPDATE OR DELETE ON project_permission
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project_profile ON project_profile;
    CREATE TRIGGER trg_journal_project_profile
      BEFORE INSERT OR UPDATE OR DELETE ON project_profile
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_project_profile ON project_profile;
    CREATE TRIGGER trg_audit_project_profile
      AFTER INSERT OR UPDATE OR DELETE ON project_profile
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task ON task;
    CREATE TRIGGER trg_journal_task
      BEFORE INSERT OR UPDATE OR DELETE ON task
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task ON task;
    CREATE TRIGGER trg_audit_task
      AFTER INSERT OR UPDATE OR DELETE ON task
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_geometry ON geometry;
    CREATE TRIGGER trg_journal_geometry
      BEFORE INSERT OR UPDATE OR DELETE ON geometry
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_geometry ON geometry;
    CREATE TRIGGER trg_audit_geometry
      AFTER INSERT OR UPDATE OR DELETE ON geometry
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_geometry ON task_geometry;
    CREATE TRIGGER trg_journal_task_geometry
      BEFORE INSERT OR UPDATE OR DELETE ON task_geometry
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task_geometry ON task_geometry;
    CREATE TRIGGER trg_audit_task_geometry
      AFTER INSERT OR UPDATE OR DELETE ON task_geometry
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_permission ON task_permission;
    CREATE TRIGGER trg_journal_task_permission
      BEFORE INSERT OR UPDATE OR DELETE ON task_permission
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task_permission ON task_permission;
    CREATE TRIGGER trg_audit_task_permission
      AFTER INSERT OR UPDATE OR DELETE ON task_permission
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_profile ON task_profile;
    CREATE TRIGGER trg_journal_task_profile
      BEFORE INSERT OR UPDATE OR DELETE ON task_profile
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task_profile ON task_profile;
    CREATE TRIGGER trg_audit_task_profile
      AFTER INSERT OR UPDATE OR DELETE ON task_profile
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project_task ON project_task;
    CREATE TRIGGER trg_journal_project_task
      BEFORE INSERT OR UPDATE OR DELETE ON project_task
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_project_task ON project_task;
    CREATE TRIGGER trg_audit_project_task
      AFTER INSERT OR UPDATE OR DELETE ON project_task
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_layer ON task_layer;
    CREATE TRIGGER trg_journal_task_layer
      BEFORE INSERT OR UPDATE OR DELETE ON task_layer
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task_layer ON task_layer;
    CREATE TRIGGER trg_audit_task_layer
      AFTER INSERT OR UPDATE OR DELETE ON task_layer
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_layer_constraint ON task_layer_constraint;
    CREATE TRIGGER trg_journal_task_layer_constraint
      BEFORE INSERT OR UPDATE OR DELETE ON task_layer_constraint
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task_layer_constraint ON task_layer_constraint;
    CREATE TRIGGER trg_audit_task_layer_constraint
      AFTER INSERT OR UPDATE OR DELETE ON task_layer_constraint
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_tile ON task_tile;
    CREATE TRIGGER trg_journal_task_tile
      BEFORE INSERT OR UPDATE OR DELETE ON task_tile
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task_tile ON task_tile;
    CREATE TRIGGER trg_audit_task_tile
      AFTER INSERT OR UPDATE OR DELETE ON task_tile
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;

    -- Drop audit triggers
    DROP TRIGGER IF EXISTS trg_audit_role ON role;
    DROP TRIGGER IF EXISTS trg_audit_profile ON profile;
    DROP TRIGGER IF EXISTS trg_audit_project ON project;
    DROP TRIGGER IF EXISTS trg_audit_project_permission ON project_permission;
    DROP TRIGGER IF EXISTS trg_audit_project_profile ON project_profile;
    DROP TRIGGER IF EXISTS trg_audit_task ON task;
    DROP TRIGGER IF EXISTS trg_audit_geometry ON geometry;
    DROP TRIGGER IF EXISTS trg_audit_task_geometry ON task_geometry;
    DROP TRIGGER IF EXISTS trg_audit_task_permission ON task_permission;
    DROP TRIGGER IF EXISTS trg_audit_task_profile ON task_profile;
    DROP TRIGGER IF EXISTS trg_audit_project_task ON project_task;
    DROP TRIGGER IF EXISTS trg_audit_task_layer ON task_layer;
    DROP TRIGGER IF EXISTS trg_audit_task_layer_constraint ON task_layer_constraint;
    DROP TRIGGER IF EXISTS trg_audit_task_tile ON task_tile;

    -- Drop journal triggers
    DROP TRIGGER IF EXISTS trg_journal_role ON role;
    DROP TRIGGER IF EXISTS trg_journal_profile ON profile;
    DROP TRIGGER IF EXISTS trg_journal_project ON project;
    DROP TRIGGER IF EXISTS trg_journal_project_permission ON project_permission;
    DROP TRIGGER IF EXISTS trg_journal_project_profile ON project_profile;
    DROP TRIGGER IF EXISTS trg_journal_task ON task;
    DROP TRIGGER IF EXISTS trg_journal_geometry ON geometry;
    DROP TRIGGER IF EXISTS trg_journal_task_geometry ON task_geometry;
    DROP TRIGGER IF EXISTS trg_journal_task_permission ON task_permission;
    DROP TRIGGER IF EXISTS trg_journal_task_profile ON task_profile;
    DROP TRIGGER IF EXISTS trg_journal_project_task ON project_task;
    DROP TRIGGER IF EXISTS trg_journal_task_layer ON task_layer;
    DROP TRIGGER IF EXISTS trg_journal_task_layer_constraint ON task_layer_constraint;
    DROP TRIGGER IF EXISTS trg_journal_task_tile ON task_tile;

    DROP FUNCTION IF EXISTS tr_journal_trigger();
    DROP FUNCTION IF EXISTS tr_audit_trigger();
    DROP TABLE IF EXISTS audit_log CASCADE;
  `);
}
