import { Knex } from 'knex';
import { IDENTITY_SOURCE, SYSTEM_ROLE } from '../constants/profile';

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
      CONSTRAINT audit_log_pk PRIMARY KEY (audit_log_id),
      CONSTRAINT audit_log_profile_fk FOREIGN KEY (profile_id)
        REFERENCES profile(profile_id) ON DELETE SET NULL
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
      -- Create temp table for API/db users context
      CREATE TEMP TABLE IF NOT EXISTS biohub_context_temp (tag varchar(200), value varchar(200));

      SELECT value::uuid INTO _profile_id 
      FROM biohub_context_temp 
      WHERE tag = 'profile_id';

      IF (_profile_id IS NULL) THEN
        -- Look up database user -- fixed to match actual schema (identity_source is a TYPE, not a table)
        SELECT p.profile_id INTO STRICT _profile_id
        FROM profile p
        WHERE p.identity_source = 'SYSTEM'
          AND p.profile_identifier = user;

        -- Populate temp table for subsequent calls
        INSERT INTO biohub_context_temp (tag, value)
        VALUES ('profile_id', _profile_id::varchar(200));
      END IF;

      IF (TG_OP = 'INSERT') THEN
        NEW.created_by = _profile_id;
      ELSIF (TG_OP = 'UPDATE') THEN
        NEW.updated_by = _profile_id;
        NEW.updated_at = now();
        -- Preserve immutable create fields
        NEW.created_by = OLD.created_by;
        NEW.created_at = OLD.created_at;
      END IF;

      IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
      ELSE
        RETURN NEW;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        RAISE;
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
      old_row json := NULL;
      new_row json := NULL;
    BEGIN
      -- Get current user context
      SELECT api_get_context_profile_id() INTO STRICT _profile_id;

      IF TG_OP IN ('UPDATE','DELETE') THEN
        old_row := row_to_json(OLD);
      END IF;

      IF TG_OP IN ('INSERT','UPDATE') THEN
        new_row := row_to_json(NEW);
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
        old_row,
        new_row
      );

      RETURN NEW;
    END;
    $$;

    ----------------------------------------------------------------------------------------
    -- Insert default API system profile
    ----------------------------------------------------------------------------------------
    WITH w_role AS (
      SELECT role_id
      FROM role
      WHERE name = '${SYSTEM_ROLE.ADMIN}'
    ),
    new_profile AS (
      SELECT gen_random_uuid() AS profile_id
    )
    INSERT INTO profile (
      profile_id,
      identity_source,
      profile_identifier,
      profile_guid,
      role_id,
      created_by
    )
    SELECT
      new_profile.profile_id,
      '${IDENTITY_SOURCE.DATABASE}',
      '${process.env.DB_USER_API}',
      '${process.env.DB_USER_API}',
      w_role.role_id,
      new_profile.profile_id
    FROM w_role, new_profile;

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to tables
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_audit_profile ON profile;
    CREATE TRIGGER trg_audit_profile
      BEFORE INSERT OR UPDATE OR DELETE ON profile
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_profile ON profile;
    CREATE TRIGGER trg_journal_profile
      AFTER INSERT OR UPDATE OR DELETE ON profile
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_project ON project;
    CREATE TRIGGER trg_audit_project
      BEFORE INSERT OR UPDATE OR DELETE ON project
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project ON project;
    CREATE TRIGGER trg_journal_project
      AFTER INSERT OR UPDATE OR DELETE ON project
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_project_permission ON project_permission;
    CREATE TRIGGER trg_audit_project_permission
      BEFORE INSERT OR UPDATE OR DELETE ON project_permission
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project_permission ON project_permission;
    CREATE TRIGGER trg_journal_project_permission
      AFTER INSERT OR UPDATE OR DELETE ON project_permission
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_project_profile ON project_profile;
    CREATE TRIGGER trg_audit_project_profile
      BEFORE INSERT OR UPDATE OR DELETE ON project_profile
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project_profile ON project_profile;
    CREATE TRIGGER trg_journal_project_profile
      AFTER INSERT OR UPDATE OR DELETE ON project_profile
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task ON task;
    CREATE TRIGGER trg_audit_task
      BEFORE INSERT OR UPDATE OR DELETE ON task
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task ON task;
    CREATE TRIGGER trg_journal_task
      AFTER INSERT OR UPDATE OR DELETE ON task
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task_permission ON task_permission;
    CREATE TRIGGER trg_audit_task_permission
      BEFORE INSERT OR UPDATE OR DELETE ON task_permission
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_permission ON task_permission;
    CREATE TRIGGER trg_journal_task_permission
      AFTER INSERT OR UPDATE OR DELETE ON task_permission
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task_profile ON task_profile;
    CREATE TRIGGER trg_audit_task_profile
      BEFORE INSERT OR UPDATE OR DELETE ON task_profile
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_profile ON task_profile;
    CREATE TRIGGER trg_journal_task_profile
      AFTER INSERT OR UPDATE OR DELETE ON task_profile
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_project_task ON project_task;
    CREATE TRIGGER trg_audit_project_task
      BEFORE INSERT OR UPDATE OR DELETE ON project_task
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project_task ON project_task;
    CREATE TRIGGER trg_journal_project_task
      AFTER INSERT OR UPDATE OR DELETE ON project_task
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task_layer ON task_layer;
    CREATE TRIGGER trg_audit_task_layer
      BEFORE INSERT OR UPDATE OR DELETE ON task_layer
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_layer ON task_layer;
    CREATE TRIGGER trg_journal_task_layer
      AFTER INSERT OR UPDATE OR DELETE ON task_layer
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task_layer_constraint ON task_layer_constraint;
    CREATE TRIGGER trg_audit_task_layer_constraint
      BEFORE INSERT OR UPDATE OR DELETE ON task_layer_constraint
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_layer_constraint ON task_layer_constraint;
    CREATE TRIGGER trg_journal_task_layer_constraint
      AFTER INSERT OR UPDATE OR DELETE ON task_layer_constraint
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_task_tile ON task_tile;
    CREATE TRIGGER trg_audit_task_tile
      BEFORE INSERT OR UPDATE OR DELETE ON task_tile
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_tile ON task_tile;
    CREATE TRIGGER trg_journal_task_tile
      AFTER INSERT OR UPDATE OR DELETE ON task_tile
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;

    -- Drop audit triggers
    DROP TRIGGER IF EXISTS trg_audit_profile ON profile;
    DROP TRIGGER IF EXISTS trg_audit_project ON project;
    DROP TRIGGER IF EXISTS trg_audit_project_permission ON project_permission;
    DROP TRIGGER IF EXISTS trg_audit_project_profile ON project_profile;
    DROP TRIGGER IF EXISTS trg_audit_task ON task;
    DROP TRIGGER IF EXISTS trg_audit_task_permission ON task_permission;
    DROP TRIGGER IF EXISTS trg_audit_task_profile ON task_profile;
    DROP TRIGGER IF EXISTS trg_audit_project_task ON project_task;
    DROP TRIGGER IF EXISTS trg_audit_task_layer ON task_layer;
    DROP TRIGGER IF EXISTS trg_audit_task_layer_constraint ON task_layer_constraint;
    DROP TRIGGER IF EXISTS trg_audit_task_tile ON task_tile;

    -- Drop journal triggers
    DROP TRIGGER IF EXISTS trg_journal_profile ON profile;
    DROP TRIGGER IF EXISTS trg_journal_project ON project;
    DROP TRIGGER IF EXISTS trg_journal_project_permission ON project_permission;
    DROP TRIGGER IF EXISTS trg_journal_project_profile ON project_profile;
    DROP TRIGGER IF EXISTS trg_journal_task ON task;
    DROP TRIGGER IF EXISTS trg_journal_task_permission ON task_permission;
    DROP TRIGGER IF EXISTS trg_journal_task_profile ON task_profile;
    DROP TRIGGER IF EXISTS trg_journal_project_task ON project_task;
    DROP TRIGGER IF EXISTS trg_journal_task_layer ON task_layer;
    DROP TRIGGER IF EXISTS trg_journal_task_layer_constraint ON task_layer_constraint;
    DROP TRIGGER IF EXISTS trg_journal_task_tile ON task_tile;

    -- Delete default API profile
    DELETE FROM profile WHERE profile_identifier = '${process.env.DB_USER_API}';

    DROP FUNCTION IF EXISTS tr_journal_trigger();
    DROP FUNCTION IF EXISTS tr_audit_trigger();
    DROP TABLE IF EXISTS audit_log CASCADE;
  `);
}
