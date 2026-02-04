import { Knex } from 'knex';

/**
 * Create project, task, project_task, task_layer, and task_layer_constraint tables
 * with UUID primary keys and full column comments.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    CREATE TYPE identity_source AS ENUM ('SYSTEM', 'IDIR', 'DATABASE');
    CREATE TYPE role_scope AS ENUM ('system', 'task', 'profile');

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

    -- Adding unique index on name and scope where record_end_date is NULL
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
      record_effective_date       timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date             timestamptz(6),
      created_at                 timestamptz(6)    DEFAULT now() NOT NULL,
      created_by              uuid,
      updated_at                 timestamptz(6),
      updated_by              uuid,
      CONSTRAINT profile_pk PRIMARY KEY (profile_id)
    );

    CREATE INDEX profile_idx1 ON profile (identity_source);
    CREATE INDEX profile_idx2 ON profile (role_id);

    COMMENT ON TABLE profile IS 'Tracks system profiles for auditing and permissions.';
    COMMENT ON COLUMN profile.profile_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN profile.role_id IS 'Role of the user in the system.';
    COMMENT ON COLUMN profile.identity_source IS 'Identifier for the source of the profile identity.';
    COMMENT ON COLUMN profile.profile_identifier IS 'The identifier of the profile.';
    COMMENT ON COLUMN profile.profile_guid IS 'The globally unique identifier for the profile.';
    COMMENT ON COLUMN profile.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN profile.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN profile.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN profile.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN profile.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN profile.updated_by IS 'The id of the profile who updated the record.';

    ----------------------------------------------------------------------------------------
    -- Project Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE project (
      project_id              uuid              DEFAULT gen_random_uuid(),
      name                    varchar(100)      NOT NULL,
      description             varchar(500),
      record_effective_date   timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date         timestamptz(6),
      created_at             timestamptz(6)    DEFAULT now() NOT NULL,
      created_by          uuid              NOT NULL,
      updated_at             timestamptz(6),
      updated_by          uuid,
      CONSTRAINT project_pk PRIMARY KEY (project_id)
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
      created_at             timestamptz(6)    DEFAULT now() NOT NULL,
      created_by          uuid              NOT NULL,
      updated_at             timestamptz(6),
      updated_by          uuid,
      CONSTRAINT project_permission_pk PRIMARY KEY (project_permission_id)
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
      CONSTRAINT project_profile_pk PRIMARY KEY (project_profile_id)
    );

    CREATE UNIQUE INDEX project_profile_uk1 ON project_profile (project_id, profile_id) WHERE record_end_date IS NULL;

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

    -- Add foreign key constraints
    ALTER TABLE project_profile ADD CONSTRAINT project_profile_fk1 FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE CASCADE;
    ALTER TABLE project_profile ADD CONSTRAINT project_profile_fk2 FOREIGN KEY (profile_id) REFERENCES profile(profile_id) ON DELETE CASCADE;
    ALTER TABLE project_profile ADD CONSTRAINT project_profile_fk3 FOREIGN KEY (project_permission_id) REFERENCES project_permission(project_permission_id) ON DELETE CASCADE;
    ALTER TABLE project_profile ADD CONSTRAINT project_profile_fk4 FOREIGN KEY (created_by) REFERENCES profile(profile_id) ON DELETE SET NULL;
    ALTER TABLE project_profile ADD CONSTRAINT project_profile_fk5 FOREIGN KEY (updated_by) REFERENCES profile(profile_id) ON DELETE SET NULL;

    -- Add indexes for foreign keys
    CREATE INDEX project_profile_idx1 ON project_profile(project_id);
    CREATE INDEX project_profile_idx2 ON project_profile(profile_id);


    ----------------------------------------------------------------------------------------
    -- Task Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE task (
      task_id                 uuid              DEFAULT gen_random_uuid(),
      name                    varchar(100)      NOT NULL,
      description             varchar(500),
      tileset_uri             text,
      record_effective_date   timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date         timestamptz(6),
      created_at             timestamptz(6)    DEFAULT now() NOT NULL,
      created_by          uuid              NOT NULL,
      updated_at             timestamptz(6),
      updated_by          uuid,
      CONSTRAINT task_pk PRIMARY KEY (task_id)
    );

    COMMENT ON TABLE task IS 'Task table.';
    COMMENT ON COLUMN task.task_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN task.name IS 'The name of the task.';
    COMMENT ON COLUMN task.description IS 'Task description.';
    COMMENT ON COLUMN task.tileset_uri IS 'URI for the latest tileset artifact.';
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
      created_at             timestamptz(6)    DEFAULT now() NOT NULL,
      created_by          uuid              NOT NULL,
      updated_at             timestamptz(6),
      updated_by          uuid,
      CONSTRAINT task_permission_pk PRIMARY KEY (task_permission_id)
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
      created_at             timestamptz(6)    DEFAULT now() NOT NULL,
      created_by          uuid              NOT NULL,
      updated_at             timestamptz(6),
      updated_by          uuid,
      CONSTRAINT task_profile_pk PRIMARY KEY (task_profile_id)
    );

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

    -- Add foreign key constraints
    ALTER TABLE task_profile ADD CONSTRAINT task_profile_fk1 
      FOREIGN KEY (task_id) REFERENCES task(task_id) ON DELETE CASCADE;
    ALTER TABLE task_profile ADD CONSTRAINT task_profile_fk2 
      FOREIGN KEY (profile_id) REFERENCES profile(profile_id) ON DELETE CASCADE;
    ALTER TABLE task_profile ADD CONSTRAINT task_profile_fk3 
      FOREIGN KEY (task_permission_id) REFERENCES task_permission(task_permission_id) ON DELETE CASCADE;
    ALTER TABLE task_profile ADD CONSTRAINT task_profile_fk4 
      FOREIGN KEY (created_by) REFERENCES profile(profile_id);
    ALTER TABLE task_profile ADD CONSTRAINT task_profile_fk5 
      FOREIGN KEY (updated_by) REFERENCES profile(profile_id);

    -- Add indexes for foreign keys
    CREATE INDEX task_profile_idx1 ON task_profile(task_id);
    CREATE INDEX task_profile_idx2 ON task_profile(profile_id);
    
    CREATE UNIQUE INDEX task_profile_uk1 ON task_profile (task_id, profile_id) WHERE record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- Project Task Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE project_task (
      project_task_id         uuid              DEFAULT gen_random_uuid(),
      project_id              uuid              NOT NULL,
      task_id                 uuid              NOT NULL,
      created_at             timestamptz(6)    DEFAULT now() NOT NULL,
      created_by          uuid              NOT NULL,
      updated_at             timestamptz(6),
      updated_by          uuid,
      CONSTRAINT project_task_pk PRIMARY KEY (project_task_id)
    );

    COMMENT ON TABLE project_task IS 'Join table linking projects and tasks.';
    COMMENT ON COLUMN project_task.project_task_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN project_task.project_id IS 'Foreign key referencing project.';
    COMMENT ON COLUMN project_task.task_id IS 'Foreign key referencing task.';
    COMMENT ON COLUMN project_task.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN project_task.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN project_task.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN project_task.updated_by IS 'The id of the profile who updated the record.';

    -- Add foreign key constraints
    ALTER TABLE project_task ADD CONSTRAINT project_task_fk1 
      FOREIGN KEY (project_id) REFERENCES project(project_id);
    ALTER TABLE project_task ADD CONSTRAINT project_task_fk2 
      FOREIGN KEY (task_id) REFERENCES task(task_id);

    -- Add indexes for foreign keys
    CREATE INDEX project_task_idx1 ON project_task(project_id);
    CREATE INDEX project_task_idx2 ON project_task(task_id);

    CREATE UNIQUE INDEX project_task_uk1 ON project_task (project_id, task_id);

    ----------------------------------------------------------------------------------------
    -- Task Layer Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE task_layer (
      task_layer_id           uuid              DEFAULT gen_random_uuid(),
      task_id                 uuid              NOT NULL,
      layer_name              varchar(100)      NOT NULL,
      description             varchar(500),
      record_effective_date   timestamptz(6)    DEFAULT now() NOT NULL,
      record_end_date         timestamptz(6),
      created_at             timestamptz(6)    DEFAULT now() NOT NULL,
      created_by              uuid              NOT NULL,
      updated_at             timestamptz(6),
      updated_by          uuid,
      CONSTRAINT task_layer_pk PRIMARY KEY (task_layer_id)
    );

    COMMENT ON TABLE task_layer IS 'Task layer table, references tasks.';
    COMMENT ON COLUMN task_layer.task_layer_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN task_layer.task_id IS 'Foreign key referencing task.';
    COMMENT ON COLUMN task_layer.layer_name IS 'The name of the task layer.';
    COMMENT ON COLUMN task_layer.description IS 'Task layer description.';
    COMMENT ON COLUMN task_layer.record_effective_date IS 'Record level effective date.';
    COMMENT ON COLUMN task_layer.record_end_date IS 'Record level end date.';
    COMMENT ON COLUMN task_layer.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN task_layer.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN task_layer.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN task_layer.updated_by IS 'The id of the profile who updated the record.';

    -- Add foreign key constraint
    ALTER TABLE task_layer ADD CONSTRAINT task_layer_fk1 
      FOREIGN KEY (task_id) REFERENCES task(task_id);

    -- Add index for foreign key
    CREATE INDEX task_layer_idx1 ON task_layer(task_id);

    ----------------------------------------------------------------------------------------
    -- Task Layer Constraint Table
    ----------------------------------------------------------------------------------------

    CREATE TABLE task_layer_constraint (
      task_layer_constraint_id  uuid            DEFAULT gen_random_uuid(),
      task_layer_id             uuid            NOT NULL,
      constraint_name           varchar(100)    NOT NULL,
      constraint_value          varchar(500),
      created_at               timestamptz(6)  DEFAULT now() NOT NULL,
      created_by            uuid            NOT NULL,
      updated_at               timestamptz(6),
      updated_by            uuid,
      CONSTRAINT task_layer_constraint_pk PRIMARY KEY (task_layer_constraint_id)
    );

    COMMENT ON TABLE task_layer_constraint IS 'Defines constraints for a specific task layer.';
    COMMENT ON COLUMN task_layer_constraint.task_layer_constraint_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN task_layer_constraint.task_layer_id IS 'Foreign key referencing task_layer.';
    COMMENT ON COLUMN task_layer_constraint.constraint_name IS 'The name of the constraint for the task layer.';
    COMMENT ON COLUMN task_layer_constraint.constraint_value IS 'The value of the constraint.';
    COMMENT ON COLUMN task_layer_constraint.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN task_layer_constraint.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN task_layer_constraint.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN task_layer_constraint.updated_by IS 'The id of the profile who updated the record.';

    -- Add foreign key constraint
    ALTER TABLE task_layer_constraint ADD CONSTRAINT task_layer_constraint_fk1 
      FOREIGN KEY (task_layer_id) REFERENCES task_layer(task_layer_id);

    -- Add index for foreign key
    CREATE INDEX task_layer_constraint_idx1 ON task_layer_constraint(task_layer_id);

    ----------------------------------------------------------------------------------------
    -- Task Tile Table
    ----------------------------------------------------------------------------------------

    CREATE TYPE task_tile_status AS ENUM ('DRAFT', 'STARTED', 'COMPLETED', 'FAILED');

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
      created_at            timestamptz(6)    DEFAULT now() NOT NULL,
      created_by             uuid              NOT NULL,
      updated_at            timestamptz(6),
      updated_by         uuid,
      CONSTRAINT task_tile_pk PRIMARY KEY (task_tile_id)
    );

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

    ALTER TABLE task_tile ADD CONSTRAINT task_tile_fk1
      FOREIGN KEY (task_id) REFERENCES task(task_id);

    CREATE INDEX task_tile_idx1 ON task_tile(task_id);
    CREATE UNIQUE INDEX task_tile_uk1 ON task_tile (task_id) WHERE status IN ('DRAFT', 'STARTED');

  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;

    DROP TABLE IF EXISTS task_layer_constraint;
    DROP TABLE IF EXISTS task_layer;
    DROP TABLE IF EXISTS project_task;
    DROP TABLE IF EXISTS task_profile;
    DROP TABLE IF EXISTS task_permission;
    DROP TABLE IF EXISTS task_tile;
    DROP TABLE IF EXISTS task;
    DROP TABLE IF EXISTS project_profile;
    DROP TABLE IF EXISTS project_permission;
    DROP TABLE IF EXISTS profile;
    DROP TABLE IF EXISTS role;
    DROP TYPE IF EXISTS task_tile_status;
  `);
}
