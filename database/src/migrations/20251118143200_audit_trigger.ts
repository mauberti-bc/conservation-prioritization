import { Knex } from 'knex';
import { IDENTITY_SOURCE, SYSTEM_ROLE } from '../constants/profile';

/**
 * Insert default API system profile and attach audit and journal triggers to all tables
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;

    ----------------------------------------------------------------------------------------
    -- Insert default API system profile
    ----------------------------------------------------------------------------------------
    -- Step 1: Insert first profile with role resolved via CTE
    WITH w_role AS (
      SELECT role_id
      FROM role
      WHERE name = '${SYSTEM_ROLE.ADMIN}'
    )
    INSERT INTO profile (
      identity_source,
      profile_identifier,
      profile_guid,
      role_id
    )
    SELECT
      '${IDENTITY_SOURCE.DATABASE}',
      '${process.env.DB_USER_API}',
      '${process.env.DB_USER_API}',
      w_role.role_id
    FROM w_role
    RETURNING profile_id;

    ----------------------------------------------------------------------------------------
    -- Step 2: Update the profile so created_by = profile_id
    ----------------------------------------------------------------------------------------
    UPDATE profile
    SET created_by = profile_id
    WHERE identity_source = '${IDENTITY_SOURCE.DATABASE}'
      AND profile_identifier = '${process.env.DB_USER_API}';

    ----------------------------------------------------------------------------------------
    -- Step 3: Now enforce NOT NULL on created_by
    ----------------------------------------------------------------------------------------
    ALTER TABLE profile
      ALTER COLUMN created_by SET NOT NULL;

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to profile
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_audit_profile ON profile;
    CREATE TRIGGER trg_audit_profile
      BEFORE INSERT OR UPDATE OR DELETE ON profile
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_profile ON profile;
    CREATE TRIGGER trg_journal_profile
      AFTER INSERT OR UPDATE OR DELETE ON profile
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to project
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_audit_project ON project;
    CREATE TRIGGER trg_audit_project
      BEFORE INSERT OR UPDATE OR DELETE ON project
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project ON project;
    CREATE TRIGGER trg_journal_project
      AFTER INSERT OR UPDATE OR DELETE ON project
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to project_permission
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_audit_project_permission ON project_permission;
    CREATE TRIGGER trg_audit_project_permission
      BEFORE INSERT OR UPDATE OR DELETE ON project_permission
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project_permission ON project_permission;
    CREATE TRIGGER trg_journal_project_permission
      AFTER INSERT OR UPDATE OR DELETE ON project_permission
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to project_profile
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_audit_project_profile ON project_profile;
    CREATE TRIGGER trg_audit_project_profile
      BEFORE INSERT OR UPDATE OR DELETE ON project_profile
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project_profile ON project_profile;
    CREATE TRIGGER trg_journal_project_profile
      AFTER INSERT OR UPDATE OR DELETE ON project_profile
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to task
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_audit_task ON task;
    CREATE TRIGGER trg_audit_task
      BEFORE INSERT OR UPDATE OR DELETE ON task
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task ON task;
    CREATE TRIGGER trg_journal_task
      AFTER INSERT OR UPDATE OR DELETE ON task
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to task_permission
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_audit_task_permission ON task_permission;
    CREATE TRIGGER trg_audit_task_permission
      BEFORE INSERT OR UPDATE OR DELETE ON task_permission
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_permission ON task_permission;
    CREATE TRIGGER trg_journal_task_permission
      AFTER INSERT OR UPDATE OR DELETE ON task_permission
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to task_profile
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_audit_task_profile ON task_profile;
    CREATE TRIGGER trg_audit_task_profile
      BEFORE INSERT OR UPDATE OR DELETE ON task_profile
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_profile ON task_profile;
    CREATE TRIGGER trg_journal_task_profile
      AFTER INSERT OR UPDATE OR DELETE ON task_profile
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to project_task
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_audit_project_task ON project_task;
    CREATE TRIGGER trg_audit_project_task
      BEFORE INSERT OR UPDATE OR DELETE ON project_task
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_project_task ON project_task;
    CREATE TRIGGER trg_journal_project_task
      AFTER INSERT OR UPDATE OR DELETE ON project_task
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to task_layer
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_audit_task_layer ON task_layer;
    CREATE TRIGGER trg_audit_task_layer
      BEFORE INSERT OR UPDATE OR DELETE ON task_layer
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_layer ON task_layer;
    CREATE TRIGGER trg_journal_task_layer
      AFTER INSERT OR UPDATE OR DELETE ON task_layer
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to task_layer_constraint
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_audit_task_layer_constraint ON task_layer_constraint;
    CREATE TRIGGER trg_audit_task_layer_constraint
      BEFORE INSERT OR UPDATE OR DELETE ON task_layer_constraint
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_task_layer_constraint ON task_layer_constraint;
    CREATE TRIGGER trg_journal_task_layer_constraint
      AFTER INSERT OR UPDATE OR DELETE ON task_layer_constraint
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

    -- Delete default API profile
    DELETE FROM profile WHERE profile_identifier = 'API';
  `);
}
