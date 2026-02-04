import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql

    SET search_path=conservation,public;
    
    ----------------------------------------------------------------------------------------
    -- Audit Log Table
    ----------------------------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS audit_log (
      audit_log_id       uuid            DEFAULT gen_random_uuid(),
      profile_id         uuid            NOT NULL,
      create_date        timestamptz(6)  DEFAULT now() NOT NULL,
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
    COMMENT ON COLUMN audit_log.create_date IS 'The date and time of record creation.';
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
        NEW.create_profile = _profile_id;
      ELSIF (TG_OP = 'UPDATE') THEN
        NEW.update_profile = _profile_id;
        NEW.update_date = now();
        -- Preserve immutable create fields
        NEW.create_profile = OLD.create_profile;
        NEW.create_date = OLD.create_date;
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
      SELECT api_get_context_user_id() INTO STRICT _profile_id;

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
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;

    DROP FUNCTION IF EXISTS tr_journal_trigger();
    DROP FUNCTION IF EXISTS tr_audit_trigger();
    DROP TABLE IF EXISTS audit_log CASCADE;
  `);
}
