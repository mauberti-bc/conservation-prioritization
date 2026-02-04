import { Knex } from 'knex';
import { IDENTITY_SOURCE } from '../constants/profile';
import { SEED_CONSTANTS } from '../constants/seeds';

/* ============================================================================
 * Environment
 * ========================================================================== */

const DB_SCHEMA = process.env.DB_SCHEMA!;
const DB_USER_PREFECT = process.env.DB_USER_PREFECT || 'prefect';
const DB_USER_API = process.env.DB_USER_API!;

const C = SEED_CONSTANTS;

/* ============================================================================
 * Global Reference Data Seed (roles, events, pricing, etc.)
 * ========================================================================== */

export async function seed(knex: Knex): Promise<void> {
  void DB_USER_PREFECT;

  await knex.raw(`
    SET SCHEMA '${DB_SCHEMA}';
    SET SEARCH_PATH=${DB_SCHEMA},public;
  `);

  const apiProfile = await knex('profile')
    .select('profile_id')
    .where({ profile_identifier: DB_USER_API, identity_source: 'database', record_end_date: null })
    .first();

  if (!apiProfile?.profile_id) {
    throw new Error('Seed requires the API profile to exist. Run migrations first.');
  }

  await knex.raw(`SELECT api_set_context('${DB_USER_API}', 'database');`);

  /* ==========================================================================
   * CLEAR DATA (demo-only tables)
   * ========================================================================== */

  await knex.raw(`SET session_replication_role = 'replica';`);

  for (const table of C.TABLES_TO_CLEAR) {
    await knex(table).del();
  }

  await knex.raw(`SET session_replication_role = 'origin';`);

  /* ==========================================================================
   * ROLES (from SEED_CONSTANTS)
   * ========================================================================== */

  for (const role of C.SYSTEM_ROLES) {
    await knex.raw(
      `
        INSERT INTO role (name, description, scope)
        SELECT ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM role WHERE name = ? AND scope = ? AND record_end_date IS NULL
        )
      `,
      [role.name, role.description, role.scope, role.name, role.scope]
    );
  }

  for (const role of C.PROJECT_ROLES) {
    await knex.raw(
      `
        INSERT INTO role (name, description, scope)
        SELECT ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM role WHERE name = ? AND scope = ? AND record_end_date IS NULL
        )
      `,
      [role.name, role.description, role.scope, role.name, role.scope]
    );
  }

  for (const role of C.TASK_ROLES) {
    await knex.raw(
      `
        INSERT INTO role (name, description, scope)
        SELECT ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM role WHERE name = ? AND scope = ? AND record_end_date IS NULL
        )
      `,
      [role.name, role.description, role.scope, role.name, role.scope]
    );
  }

  const projectAdminRole = await knex('role')
    .select('role_id')
    .where({ name: 'admin', scope: 'profile', record_end_date: null })
    .first();

  const taskAdminRole = await knex('role')
    .select('role_id')
    .where({ name: 'admin', scope: 'task', record_end_date: null })
    .first();

  /* ==========================================================================
   * PROFILES (from SEED_CONSTANTS)
   * ========================================================================== */

  for (const profile of C.PROFILES) {
    const resolvedRole = await knex('role')
      .select('role_id')
      .where({ name: profile.system_role ?? 'member', scope: 'system', record_end_date: null })
      .first();

    await knex('profile').insert({
      profile_guid: profile.profile_guid,
      profile_identifier: profile.profile_identifier,
      identity_source: profile.identity_source,
      role_id: resolvedRole?.role_id || null,
      display_name: profile.display_name,
      email: profile.email,
      given_name: profile.given_name,
      family_name: profile.family_name,
      agency: profile.agency,
      notes: profile.notes
    });
  }

  /* ==========================================================================
   * PROJECTS
   * ========================================================================== */

  for (const project of C.PROJECTS) {
    await knex('project').insert(project);
  }

  /* ==========================================================================
   * TASKS
   * ========================================================================== */

  for (const task of C.TASKS) {
    await knex('task').insert(task);
  }

  const identitySources = Object.values(IDENTITY_SOURCE).filter((source) => source !== IDENTITY_SOURCE.DATABASE);

  const nonDatabaseProfiles = await knex('profile')
    .select('profile_id')
    .whereIn('identity_source', identitySources)
    .andWhere({ record_end_date: null });

  /* ==========================================================================
   * PROJECT PERMISSIONS
   * ======================================================================== */

  const seededProjects = await knex('project')
    .select('project_id')
    .whereIn(
      'name',
      C.PROJECTS.map((project) => project.name)
    );

  if (projectAdminRole?.role_id) {
    for (const project of seededProjects) {
      for (const profile of nonDatabaseProfiles) {
        await knex('project_permission').insert({
          project_id: project.project_id,
          profile_id: profile.profile_id,
          role_id: projectAdminRole.role_id
        });
      }
    }
  }

  /* ==========================================================================
   * TASK PERMISSIONS
   * ======================================================================== */

  const seededTasks = await knex('task')
    .select('task_id')
    .whereIn(
      'name',
      C.TASKS.map((task) => task.name)
    );

  if (taskAdminRole?.role_id) {
    for (const task of seededTasks) {
      for (const profile of nonDatabaseProfiles) {
        await knex('task_permission').insert({
          task_id: task.task_id,
          profile_id: profile.profile_id,
          role_id: taskAdminRole.role_id
        });
      }
    }
  }

  /* ==========================================================================
   * PROJECT PROFILES
   * ========================================================================== */

  const demoProjects = await knex('project')
    .select('project_id', 'name')
    .whereIn(
      'name',
      C.PROJECTS.map((project) => project.name)
    );

  for (const profile of nonDatabaseProfiles) {
    for (const project of demoProjects) {
      await knex('project_profile').insert({
        project_id: project.project_id,
        profile_id: profile.profile_id
      });
    }
  }

  /* ==========================================================================
   * TASK PROFILES
   * ========================================================================== */

  const demoTasks = await knex('task')
    .select('task_id')
    .whereIn(
      'name',
      C.TASKS.map((task) => task.name)
    );

  const demoTask = demoTasks[0];

  if (demoTasks.length) {
    for (const profile of nonDatabaseProfiles) {
      for (const task of demoTasks) {
        await knex('task_profile').insert({
          task_id: task.task_id,
          profile_id: profile.profile_id
        });
      }
    }
  }

  /* ==========================================================================
   * PROJECT TASKS
   * ========================================================================== */

  if (demoTask?.task_id) {
    for (const project of demoProjects) {
      await knex('project_task').insert({
        project_id: project.project_id,
        task_id: demoTask.task_id
      });
    }
  }

  /* ==========================================================================
   * TASK LAYERS
   * ========================================================================== */

  if (demoTask?.task_id) {
    for (const layer of C.TASK_LAYERS) {
      await knex('task_layer').insert({
        task_id: demoTask.task_id,
        layer_name: layer.layer_name,
        description: layer.description,
        mode: layer.mode,
        importance: layer.importance,
        threshold: layer.threshold
      });
    }
  }

  const demoTaskLayer = await knex('task_layer')
    .select('task_layer_id')
    .where({ layer_name: 'landcover/forest' })
    .first();

  /* ==========================================================================
   * TASK LAYER CONSTRAINTS
   * ========================================================================== */

  if (demoTaskLayer?.task_layer_id) {
    for (const constraint of C.TASK_LAYER_CONSTRAINTS) {
      await knex('task_layer_constraint').insert({
        task_layer_id: demoTaskLayer.task_layer_id,
        type: constraint.type,
        min: constraint.min,
        max: constraint.max
      });
    }
  }

  /* ==========================================================================
   * TASK TILES
   * ========================================================================== */

  if (demoTask?.task_id) {
    for (const tile of C.TASK_TILES) {
      await knex('task_tile').insert({
        task_id: demoTask.task_id,
        status: tile.status,
        uri: tile.uri,
        content_type: tile.content_type
      });
    }
  }
}
