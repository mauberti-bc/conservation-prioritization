import { Knex } from 'knex';

/**
 * Create dashboard tables and permissions.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    ----------------------------------------------------------------------------------------
    -- Extend role_scope enum for dashboards
    ----------------------------------------------------------------------------------------
    ALTER TYPE role_scope ADD VALUE IF NOT EXISTS 'dashboard';

    ----------------------------------------------------------------------------------------
    -- Dashboard access scheme enum
    ----------------------------------------------------------------------------------------
    CREATE TYPE dashboard_access_scheme AS ENUM ('ANYONE_WITH_LINK', 'MEMBERS_ONLY', 'NOBODY');

    ----------------------------------------------------------------------------------------
    -- Dashboard Table
    ----------------------------------------------------------------------------------------
    CREATE TABLE dashboard (
      dashboard_id          uuid                     DEFAULT gen_random_uuid(),
      public_id             uuid                     DEFAULT gen_random_uuid(),
      name                  varchar(100)             NOT NULL,
      description           varchar(500),
      access_scheme         dashboard_access_scheme  NOT NULL DEFAULT 'NOBODY',
      record_effective_date timestamptz(6)           DEFAULT now() NOT NULL,
      record_end_date       timestamptz(6),
      created_at            timestamptz(6)           DEFAULT now() NOT NULL,
      created_by            uuid                     NOT NULL,
      updated_at            timestamptz(6),
      updated_by            uuid,
      CONSTRAINT dashboard_pk PRIMARY KEY (dashboard_id),
      CONSTRAINT dashboard_public_id_uk UNIQUE (public_id),
      CONSTRAINT dashboard_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT dashboard_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    COMMENT ON TABLE dashboard IS 'Dashboard table for grouping tasks for sharing.';
    COMMENT ON COLUMN dashboard.dashboard_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN dashboard.public_id IS 'Public share identifier for dashboard links.';
    COMMENT ON COLUMN dashboard.name IS 'The name of the dashboard.';
    COMMENT ON COLUMN dashboard.description IS 'Dashboard description.';
    COMMENT ON COLUMN dashboard.access_scheme IS 'Access scheme for sharing.';
    COMMENT ON COLUMN dashboard.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN dashboard.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN dashboard.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN dashboard.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN dashboard.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN dashboard.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Dashboard Task Table
    ----------------------------------------------------------------------------------------
    CREATE TABLE dashboard_task (
      dashboard_task_id     uuid           DEFAULT gen_random_uuid(),
      dashboard_id          uuid           NOT NULL,
      task_id               uuid           NOT NULL,
      record_effective_date timestamptz(6) DEFAULT now() NOT NULL,
      record_end_date       timestamptz(6),
      created_at            timestamptz(6) DEFAULT now() NOT NULL,
      created_by            uuid           NOT NULL,
      updated_at            timestamptz(6),
      updated_by            uuid,
      CONSTRAINT dashboard_task_pk PRIMARY KEY (dashboard_task_id),
      CONSTRAINT dashboard_task_dashboard_fk FOREIGN KEY (dashboard_id) REFERENCES dashboard(dashboard_id) ON DELETE CASCADE,
      CONSTRAINT dashboard_task_task_fk FOREIGN KEY (task_id) REFERENCES task(task_id) ON DELETE CASCADE,
      CONSTRAINT dashboard_task_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT dashboard_task_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX dashboard_task_uk1 ON dashboard_task (dashboard_id, task_id) WHERE record_end_date IS NULL;
    CREATE INDEX dashboard_task_idx1 ON dashboard_task (dashboard_id);
    CREATE INDEX dashboard_task_idx2 ON dashboard_task (task_id);

    COMMENT ON TABLE dashboard_task IS 'Join table linking dashboards and tasks.';
    COMMENT ON COLUMN dashboard_task.dashboard_task_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN dashboard_task.dashboard_id IS 'Foreign key referencing dashboard.';
    COMMENT ON COLUMN dashboard_task.task_id IS 'Foreign key referencing task.';
    COMMENT ON COLUMN dashboard_task.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN dashboard_task.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN dashboard_task.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN dashboard_task.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN dashboard_task.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN dashboard_task.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Dashboard Permission Table
    ----------------------------------------------------------------------------------------
    CREATE TABLE dashboard_permission (
      dashboard_permission_id uuid          DEFAULT gen_random_uuid(),
      dashboard_id            uuid          NOT NULL,
      profile_id              uuid          NOT NULL,
      role_id                 uuid          NOT NULL,
      record_effective_date   timestamptz(6) DEFAULT now() NOT NULL,
      record_end_date         timestamptz(6),
      created_at              timestamptz(6) DEFAULT now() NOT NULL,
      created_by              uuid           NOT NULL,
      updated_at              timestamptz(6),
      updated_by              uuid,
      CONSTRAINT dashboard_permission_pk PRIMARY KEY (dashboard_permission_id),
      CONSTRAINT dashboard_permission_dashboard_fk FOREIGN KEY (dashboard_id) REFERENCES dashboard(dashboard_id) ON DELETE CASCADE,
      CONSTRAINT dashboard_permission_profile_fk FOREIGN KEY (profile_id) REFERENCES profile(profile_id) ON DELETE CASCADE,
      CONSTRAINT dashboard_permission_role_fk FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE RESTRICT,
      CONSTRAINT dashboard_permission_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT dashboard_permission_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX dashboard_permission_uk1 ON dashboard_permission (dashboard_id, profile_id) WHERE record_end_date IS NULL;
    CREATE INDEX dashboard_permission_idx1 ON dashboard_permission (dashboard_id);
    CREATE INDEX dashboard_permission_idx2 ON dashboard_permission (profile_id);

    COMMENT ON TABLE dashboard_permission IS 'Associates profiles with dashboards and their roles.';
    COMMENT ON COLUMN dashboard_permission.dashboard_permission_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN dashboard_permission.dashboard_id IS 'Foreign key referencing dashboard.';
    COMMENT ON COLUMN dashboard_permission.profile_id IS 'Foreign key referencing profile.';
    COMMENT ON COLUMN dashboard_permission.role_id IS 'Foreign key referencing role.';
    COMMENT ON COLUMN dashboard_permission.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN dashboard_permission.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN dashboard_permission.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN dashboard_permission.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN dashboard_permission.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN dashboard_permission.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Attach audit and journal triggers to dashboard tables
    ----------------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS trg_journal_dashboard ON dashboard;
    CREATE TRIGGER trg_journal_dashboard
      BEFORE INSERT OR UPDATE OR DELETE ON dashboard
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_dashboard ON dashboard;
    CREATE TRIGGER trg_audit_dashboard
      AFTER INSERT OR UPDATE OR DELETE ON dashboard
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_dashboard_task ON dashboard_task;
    CREATE TRIGGER trg_journal_dashboard_task
      BEFORE INSERT OR UPDATE OR DELETE ON dashboard_task
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_dashboard_task ON dashboard_task;
    CREATE TRIGGER trg_audit_dashboard_task
      AFTER INSERT OR UPDATE OR DELETE ON dashboard_task
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();

    DROP TRIGGER IF EXISTS trg_journal_dashboard_permission ON dashboard_permission;
    CREATE TRIGGER trg_journal_dashboard_permission
      BEFORE INSERT OR UPDATE OR DELETE ON dashboard_permission
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    DROP TRIGGER IF EXISTS trg_audit_dashboard_permission ON dashboard_permission;
    CREATE TRIGGER trg_audit_dashboard_permission
      AFTER INSERT OR UPDATE OR DELETE ON dashboard_permission
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;

    DROP TRIGGER IF EXISTS trg_audit_dashboard_permission ON dashboard_permission;
    DROP TRIGGER IF EXISTS trg_journal_dashboard_permission ON dashboard_permission;
    DROP TRIGGER IF EXISTS trg_audit_dashboard_task ON dashboard_task;
    DROP TRIGGER IF EXISTS trg_journal_dashboard_task ON dashboard_task;
    DROP TRIGGER IF EXISTS trg_audit_dashboard ON dashboard;
    DROP TRIGGER IF EXISTS trg_journal_dashboard ON dashboard;

    DROP TABLE IF EXISTS dashboard_permission;
    DROP TABLE IF EXISTS dashboard_task;
    DROP TABLE IF EXISTS dashboard;

    DROP TYPE IF EXISTS dashboard_access_scheme;
    -- Note: role_scope enum value 'dashboard' is additive and not removed in down migration.
  `);
}
