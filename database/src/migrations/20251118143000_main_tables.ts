import { Knex } from 'knex';
import { IDENTITY_SOURCE, SYSTEM_ROLE } from '../constants/profile';

/**
 * Create core tables for roles, profiles, projects, tasks, and task configuration.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    CREATE TYPE identity_source AS ENUM ('${IDENTITY_SOURCE.SYSTEM}', '${IDENTITY_SOURCE.IDIR}', '${IDENTITY_SOURCE.DATABASE}');
    CREATE TYPE role_scope AS ENUM ('system', 'task', 'profile');
    CREATE TYPE task_status AS ENUM ('pending', 'submitted', 'running', 'completed', 'failed', 'failed_to_submit');
    CREATE TYPE task_layer_mode AS ENUM ('flexible', 'locked-in', 'locked-out');
    CREATE TYPE task_layer_constraint_type AS ENUM ('percent', 'unit');
    CREATE TYPE task_tile_status AS ENUM ('DRAFT', 'STARTED', 'COMPLETED', 'FAILED');

    ----------------------------------------------------------------------------------------
    -- Role Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE role (
      role_id                  uuid              DEFAULT gen_random_uuid(),
      name                     varchar(100)      NOT NULL,
      description              varchar(500),
      scope                    role_scope        NOT NULL,
      created_at               timestamptz(6)    DEFAULT now() NOT NULL,
      created_by               uuid              NOT NULL,
      updated_at               timestamptz(6),
      updated_by               uuid,
      record_effective_date    timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date          timestamptz(6),
      CONSTRAINT role_pk PRIMARY KEY (role_id)
    );

    COMMENT ON TABLE role IS 'Defines the roles available for different scopes (system, task, profile).';
    COMMENT ON COLUMN role.role_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN role.name IS 'Name of the role.';
    COMMENT ON COLUMN role.description IS 'Description of the role.';
    COMMENT ON COLUMN role.scope IS 'Scope of the role (e.g., system, task, profile).';
    COMMENT ON COLUMN role.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN role.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN role.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN role.updated_by IS 'The id of the profile who updated the record.';
    COMMENT ON COLUMN role.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN role.record_end_date IS 'Record level end date.';

    CREATE UNIQUE INDEX role_uk1 ON role (name, scope) WHERE record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- Profile Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE profile (
      profile_id                  uuid              DEFAULT gen_random_uuid(),
      identity_source             identity_source   NOT NULL,
      profile_identifier          varchar(200)      NOT NULL,
      profile_guid                varchar(200)      NOT NULL,
      role_id                     uuid              NOT NULL,
      agency                      varchar(200),
      display_name                varchar(200),
      email                       varchar(200),
      given_name                  varchar(200),
      family_name                 varchar(200),
      notes                       varchar(500),
      record_effective_date       timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date             timestamptz(6),
      created_at                  timestamptz(6)    DEFAULT now() NOT NULL,
      created_by                  uuid              NOT NULL,
      updated_at                  timestamptz(6),
      updated_by                  uuid,
      CONSTRAINT profile_pk PRIMARY KEY (profile_id),
      CONSTRAINT profile_role_fk FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE RESTRICT,
      CONSTRAINT profile_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT profile_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE INDEX profile_idx1 ON profile (identity_source);
    CREATE INDEX profile_idx2 ON profile (role_id);

    COMMENT ON TABLE profile IS 'Tracks system profiles for auditing and permissions.';
    COMMENT ON COLUMN profile.profile_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN profile.role_id IS 'Role of the user in the system.';
    COMMENT ON COLUMN profile.identity_source IS 'Identifier for the source of the profile identity.';
    COMMENT ON COLUMN profile.profile_identifier IS 'The identifier of the profile.';
    COMMENT ON COLUMN profile.profile_guid IS 'The globally unique identifier for the profile.';
    COMMENT ON COLUMN profile.agency IS 'Agency name for the profile.';
    COMMENT ON COLUMN profile.display_name IS 'Display name for the profile.';
    COMMENT ON COLUMN profile.email IS 'Email address for the profile.';
    COMMENT ON COLUMN profile.given_name IS 'Given name for the profile.';
    COMMENT ON COLUMN profile.family_name IS 'Family name for the profile.';
    COMMENT ON COLUMN profile.notes IS 'Notes for the profile.';

    ALTER TABLE profile
      ADD CONSTRAINT profile_guid_uk UNIQUE (profile_guid);
    COMMENT ON COLUMN profile.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN profile.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN profile.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN profile.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN profile.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN profile.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Seed system roles + default API profile
    ----------------------------------------------------------------------------------------

    WITH bootstrap AS (
      SELECT gen_random_uuid() AS profile_id
    ),
    insert_roles AS (
      INSERT INTO role (
        name,
        description,
        scope,
        created_by
      )
      SELECT
        role_name,
        role_desc,
        'system',
        bootstrap.profile_id
      FROM bootstrap,
      (VALUES
        ('${SYSTEM_ROLE.ADMIN}', 'System administrator role'),
        ('${SYSTEM_ROLE.MEMBER}', 'System member role')
      ) AS roles(role_name, role_desc)
      RETURNING role_id, name
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
      bootstrap.profile_id,
      '${IDENTITY_SOURCE.DATABASE}',
      '${process.env.DB_USER_API}',
      '${process.env.DB_USER_API}',
      (SELECT role_id FROM insert_roles WHERE name = '${SYSTEM_ROLE.ADMIN}' LIMIT 1),
      bootstrap.profile_id
    FROM bootstrap;

    ----------------------------------------------------------------------------------------
    -- Project Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE project (
      project_id              uuid              DEFAULT gen_random_uuid(),
      name                    varchar(100)      NOT NULL,
      description             varchar(500),
      record_effective_date   timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date         timestamptz(6),
      created_at              timestamptz(6)    DEFAULT now() NOT NULL,
      created_by              uuid              NOT NULL,
      updated_at              timestamptz(6),
      updated_by              uuid,
      CONSTRAINT project_pk PRIMARY KEY (project_id),
      CONSTRAINT project_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT project_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    COMMENT ON TABLE project IS 'Project table.';
    COMMENT ON COLUMN project.project_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN project.name IS 'The name of the project.';
    COMMENT ON COLUMN project.description IS 'Project description.';
    COMMENT ON COLUMN project.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN project.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN project.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN project.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN project.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN project.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Project Permission Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE project_permission (
      project_permission_id   uuid              DEFAULT gen_random_uuid(),
      role_id                 uuid              NOT NULL,
      record_effective_date   timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date         timestamptz(6),
      created_at              timestamptz(6)    DEFAULT now() NOT NULL,
      created_by              uuid              NOT NULL,
      updated_at              timestamptz(6),
      updated_by              uuid,
      CONSTRAINT project_permission_pk PRIMARY KEY (project_permission_id),
      CONSTRAINT project_permission_role_fk FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE RESTRICT,
      CONSTRAINT project_permission_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT project_permission_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX project_permission_uk1 ON project_permission (role_id) WHERE record_end_date IS NULL;

    COMMENT ON TABLE project_permission IS 'Defines the roles/permissions available for a project.';
    COMMENT ON COLUMN project_permission.project_permission_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN project_permission.role_id IS 'Foreign key referencing the role associated with this permission.';
    COMMENT ON COLUMN project_permission.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN project_permission.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN project_permission.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN project_permission.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN project_permission.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN project_permission.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Project Profile Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE project_profile (
      project_profile_id      uuid              DEFAULT gen_random_uuid(),
      project_id              uuid              NOT NULL,
      profile_id              uuid              NOT NULL,
      project_permission_id   uuid              NOT NULL,
      record_effective_date   timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date         timestamptz(6),
      created_at              timestamptz(6)    DEFAULT now() NOT NULL,
      created_by              uuid              NOT NULL,
      updated_at              timestamptz(6),
      updated_by              uuid,
      CONSTRAINT project_profile_pk PRIMARY KEY (project_profile_id),
      CONSTRAINT project_profile_project_fk FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE CASCADE,
      CONSTRAINT project_profile_profile_fk FOREIGN KEY (profile_id) REFERENCES profile(profile_id) ON DELETE CASCADE,
      CONSTRAINT project_profile_permission_fk FOREIGN KEY (project_permission_id) REFERENCES project_permission(project_permission_id) ON DELETE CASCADE,
      CONSTRAINT project_profile_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE SET NULL,
      CONSTRAINT project_profile_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX project_profile_uk1 ON project_profile (project_id, profile_id) WHERE record_end_date IS NULL;
    CREATE INDEX project_profile_idx1 ON project_profile(project_id);
    CREATE INDEX project_profile_idx2 ON project_profile(profile_id);

    COMMENT ON TABLE project_profile IS 'Associates profiles with projects and their permissions.';
    COMMENT ON COLUMN project_profile.project_profile_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN project_profile.project_id IS 'Foreign key referencing project.';
    COMMENT ON COLUMN project_profile.profile_id IS 'Foreign key referencing profile.';
    COMMENT ON COLUMN project_profile.project_permission_id IS 'Foreign key referencing project_permission.';
    COMMENT ON COLUMN project_profile.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN project_profile.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN project_profile.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN project_profile.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN project_profile.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN project_profile.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Task Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE task (
      task_id                 uuid              DEFAULT gen_random_uuid(),
      name                    varchar(100)      NOT NULL,
      description             varchar(500),
      tileset_uri             text,
      status                  task_status       NOT NULL DEFAULT 'pending',
      status_message          varchar(500),
      prefect_flow_run_id     uuid,
      prefect_deployment_id   uuid,
      record_effective_date   timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date         timestamptz(6),
      created_at              timestamptz(6)    DEFAULT now() NOT NULL,
      created_by              uuid              NOT NULL,
      updated_at              timestamptz(6),
      updated_by              uuid,
      CONSTRAINT task_pk PRIMARY KEY (task_id),
      CONSTRAINT task_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT task_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    COMMENT ON TABLE task IS 'Task table.';
    COMMENT ON COLUMN task.task_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN task.name IS 'The name of the task.';
    COMMENT ON COLUMN task.description IS 'Task description.';
    COMMENT ON COLUMN task.tileset_uri IS 'URI for the latest tileset artifact.';
    COMMENT ON COLUMN task.status IS 'Execution status for the task lifecycle.';
    COMMENT ON COLUMN task.status_message IS 'Optional status message for diagnostics.';
    COMMENT ON COLUMN task.prefect_flow_run_id IS 'Prefect flow run ID associated with the task.';
    COMMENT ON COLUMN task.prefect_deployment_id IS 'Prefect deployment ID used to launch the task.';
    COMMENT ON COLUMN task.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN task.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN task.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN task.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN task.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN task.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Task Permission Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE task_permission (
      task_permission_id      uuid              DEFAULT gen_random_uuid(),
      role_id                 uuid              NOT NULL,
      record_effective_date   timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date         timestamptz(6),
      created_at              timestamptz(6)    DEFAULT now() NOT NULL,
      created_by              uuid              NOT NULL,
      updated_at              timestamptz(6),
      updated_by              uuid,
      CONSTRAINT task_permission_pk PRIMARY KEY (task_permission_id),
      CONSTRAINT task_permission_role_fk FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE RESTRICT,
      CONSTRAINT task_permission_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT task_permission_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX task_permission_uk1 ON task_permission (role_id) WHERE record_end_date IS NULL;

    COMMENT ON TABLE task_permission IS 'Defines the roles/permissions available for a task.';
    COMMENT ON COLUMN task_permission.task_permission_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN task_permission.role_id IS 'Foreign key referencing the role associated with this permission.';
    COMMENT ON COLUMN task_permission.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN task_permission.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN task_permission.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN task_permission.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN task_permission.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN task_permission.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Task Profile Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE task_profile (
      task_profile_id         uuid              DEFAULT gen_random_uuid(),
      task_id                 uuid              NOT NULL,
      profile_id              uuid              NOT NULL,
      task_permission_id      uuid              NOT NULL,
      record_end_date         timestamptz(6),
      created_at              timestamptz(6)    DEFAULT now() NOT NULL,
      created_by              uuid              NOT NULL,
      updated_at              timestamptz(6),
      updated_by              uuid,
      CONSTRAINT task_profile_pk PRIMARY KEY (task_profile_id),
      CONSTRAINT task_profile_task_fk FOREIGN KEY (task_id) REFERENCES task(task_id) ON DELETE CASCADE,
      CONSTRAINT task_profile_profile_fk FOREIGN KEY (profile_id) REFERENCES profile(profile_id) ON DELETE CASCADE,
      CONSTRAINT task_profile_permission_fk FOREIGN KEY (task_permission_id) REFERENCES task_permission(task_permission_id) ON DELETE CASCADE,
      CONSTRAINT task_profile_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT task_profile_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX task_profile_uk1 ON task_profile (task_id, profile_id) WHERE record_end_date IS NULL;
    CREATE INDEX task_profile_idx1 ON task_profile(task_id);
    CREATE INDEX task_profile_idx2 ON task_profile(profile_id);

    COMMENT ON TABLE task_profile IS 'Associates profiles with tasks and their permissions.';
    COMMENT ON COLUMN task_profile.task_profile_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN task_profile.task_id IS 'Foreign key referencing task.';
    COMMENT ON COLUMN task_profile.profile_id IS 'Foreign key referencing profile.';
    COMMENT ON COLUMN task_profile.task_permission_id IS 'Foreign key referencing task_permission.';
    COMMENT ON COLUMN task_profile.record_end_date IS 'End date of the record for soft deletes.';
    COMMENT ON COLUMN task_profile.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN task_profile.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN task_profile.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN task_profile.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Project Task Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE project_task (
      project_task_id         uuid              DEFAULT gen_random_uuid(),
      project_id              uuid              NOT NULL,
      task_id                 uuid              NOT NULL,
      created_at              timestamptz(6)    DEFAULT now() NOT NULL,
      created_by              uuid              NOT NULL,
      updated_at              timestamptz(6),
      updated_by              uuid,
      CONSTRAINT project_task_pk PRIMARY KEY (project_task_id),
      CONSTRAINT project_task_project_fk FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE CASCADE,
      CONSTRAINT project_task_task_fk FOREIGN KEY (task_id) REFERENCES task(task_id) ON DELETE CASCADE,
      CONSTRAINT project_task_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT project_task_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX project_task_uk1 ON project_task (project_id, task_id);
    CREATE INDEX project_task_idx1 ON project_task(project_id);
    CREATE INDEX project_task_idx2 ON project_task(task_id);

    COMMENT ON TABLE project_task IS 'Join table linking projects and tasks.';
    COMMENT ON COLUMN project_task.project_task_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN project_task.project_id IS 'Foreign key referencing project.';
    COMMENT ON COLUMN project_task.task_id IS 'Foreign key referencing task.';
    COMMENT ON COLUMN project_task.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN project_task.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN project_task.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN project_task.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Task Layer Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE task_layer (
      task_layer_id           uuid              DEFAULT gen_random_uuid(),
      task_id                 uuid              NOT NULL,
      layer_name              varchar(100)      NOT NULL,
      description             varchar(500),
      mode                    task_layer_mode   NOT NULL DEFAULT 'flexible',
      importance              numeric,
      threshold               numeric,
      record_effective_date   timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date         timestamptz(6),
      created_at              timestamptz(6)    DEFAULT now() NOT NULL,
      created_by              uuid              NOT NULL,
      updated_at              timestamptz(6),
      updated_by              uuid,
      CONSTRAINT task_layer_pk PRIMARY KEY (task_layer_id),
      CONSTRAINT task_layer_task_fk FOREIGN KEY (task_id) REFERENCES task(task_id) ON DELETE CASCADE,
      CONSTRAINT task_layer_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT task_layer_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE INDEX task_layer_idx1 ON task_layer(task_id);

    COMMENT ON TABLE task_layer IS 'Task layer table, references tasks.';
    COMMENT ON COLUMN task_layer.task_layer_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN task_layer.task_id IS 'Foreign key referencing task.';
    COMMENT ON COLUMN task_layer.layer_name IS 'The name of the task layer.';
    COMMENT ON COLUMN task_layer.description IS 'Task layer description.';
    COMMENT ON COLUMN task_layer.mode IS 'Configured mode for the task layer (flexible, locked-in, locked-out).';
    COMMENT ON COLUMN task_layer.importance IS 'Relative importance when mode is flexible.';
    COMMENT ON COLUMN task_layer.threshold IS 'Threshold used when mode is locked-in or locked-out.';
    COMMENT ON COLUMN task_layer.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN task_layer.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN task_layer.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN task_layer.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN task_layer.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN task_layer.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Task Layer Constraint Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE task_layer_constraint (
      task_layer_constraint_id  uuid                         DEFAULT gen_random_uuid(),
      task_layer_id             uuid                         NOT NULL,
      type                      task_layer_constraint_type   NOT NULL DEFAULT 'unit',
      min                       numeric,
      max                       numeric,
      created_at                timestamptz(6)               DEFAULT now() NOT NULL,
      created_by                uuid                         NOT NULL,
      updated_at                timestamptz(6),
      updated_by                uuid,
      CONSTRAINT task_layer_constraint_pk PRIMARY KEY (task_layer_constraint_id),
      CONSTRAINT task_layer_constraint_task_layer_fk FOREIGN KEY (task_layer_id) REFERENCES task_layer(task_layer_id) ON DELETE CASCADE,
      CONSTRAINT task_layer_constraint_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT task_layer_constraint_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE INDEX task_layer_constraint_idx1 ON task_layer_constraint(task_layer_id);

    COMMENT ON TABLE task_layer_constraint IS 'Defines constraints for a specific task layer.';
    COMMENT ON COLUMN task_layer_constraint.task_layer_constraint_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN task_layer_constraint.task_layer_id IS 'Foreign key referencing task_layer.';
    COMMENT ON COLUMN task_layer_constraint.type IS 'Constraint type (percent or unit).';
    COMMENT ON COLUMN task_layer_constraint.min IS 'Minimum constraint value.';
    COMMENT ON COLUMN task_layer_constraint.max IS 'Maximum constraint value.';
    COMMENT ON COLUMN task_layer_constraint.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN task_layer_constraint.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN task_layer_constraint.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN task_layer_constraint.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Task Tile Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE task_tile (
      task_tile_id           uuid              DEFAULT gen_random_uuid(),
      task_id                uuid              NOT NULL,
      status                 task_tile_status  NOT NULL,
      uri                    text,
      content_type           text,
      started_at             timestamptz(6),
      completed_at           timestamptz(6),
      failed_at              timestamptz(6),
      error_code             text,
      error_message          varchar(500),
      created_at             timestamptz(6)    DEFAULT now() NOT NULL,
      created_by             uuid              NOT NULL,
      updated_at             timestamptz(6),
      updated_by             uuid,
      CONSTRAINT task_tile_pk PRIMARY KEY (task_tile_id),
      CONSTRAINT task_tile_task_fk FOREIGN KEY (task_id) REFERENCES task(task_id) ON DELETE CASCADE,
      CONSTRAINT task_tile_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE RESTRICT,
      CONSTRAINT task_tile_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL
    );

    CREATE INDEX task_tile_idx1 ON task_tile(task_id);
    CREATE UNIQUE INDEX task_tile_uk1 ON task_tile (task_id) WHERE status IN ('DRAFT', 'STARTED');

    COMMENT ON TABLE task_tile IS 'Tracks tiling artifacts for tasks.';
    COMMENT ON COLUMN task_tile.task_tile_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN task_tile.task_id IS 'Foreign key referencing task.';
    COMMENT ON COLUMN task_tile.status IS 'Status of the tiling job.';
    COMMENT ON COLUMN task_tile.uri IS 'URI for the generated PMTiles archive.';
    COMMENT ON COLUMN task_tile.content_type IS 'Content type for the PMTiles artifact.';
    COMMENT ON COLUMN task_tile.started_at IS 'Timestamp when tiling started.';
    COMMENT ON COLUMN task_tile.completed_at IS 'Timestamp when tiling completed.';
    COMMENT ON COLUMN task_tile.failed_at IS 'Timestamp when tiling failed.';
    COMMENT ON COLUMN task_tile.error_code IS 'Optional error code for tiling failures.';
    COMMENT ON COLUMN task_tile.error_message IS 'Optional error message for tiling failures.';
    COMMENT ON COLUMN task_tile.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN task_tile.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN task_tile.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN task_tile.updated_by IS 'The id of the profile who updated the record.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;

    DROP TABLE IF EXISTS task_tile;
    DROP TABLE IF EXISTS task_layer_constraint;
    DROP TABLE IF EXISTS task_layer;
    DROP TABLE IF EXISTS project_task;
    DROP TABLE IF EXISTS task_profile;
    DROP TABLE IF EXISTS task_permission;
    DROP TABLE IF EXISTS task;
    DROP TABLE IF EXISTS project_profile;
    DROP TABLE IF EXISTS project_permission;
    DROP TABLE IF EXISTS project;
    DROP TABLE IF EXISTS profile;
    DROP TABLE IF EXISTS role;

    DROP TYPE IF EXISTS task_tile_status;
    DROP TYPE IF EXISTS task_layer_constraint_type;
    DROP TYPE IF EXISTS task_layer_mode;
    DROP TYPE IF EXISTS task_status;
    DROP TYPE IF EXISTS role_scope;
    DROP TYPE IF EXISTS identity_source;
  `);
}
