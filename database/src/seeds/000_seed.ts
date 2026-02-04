import { Knex } from 'knex';
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

  /* ==========================================================================
   * PROJECT PERMISSIONS
   * ======================================================================== */

  const projectAdminRole = await knex('role')
    .select('role_id')
    .where({ name: 'project_admin', scope: 'profile', record_end_date: null })
    .first();

  const projectUserRole = await knex('role')
    .select('role_id')
    .where({ name: 'project_user', scope: 'profile', record_end_date: null })
    .first();

  if (projectAdminRole?.role_id) {
    await knex('project_permission').insert({ role_id: projectAdminRole.role_id });
  }

  if (projectUserRole?.role_id) {
    await knex('project_permission').insert({ role_id: projectUserRole.role_id });
  }

  /* ==========================================================================
   * TASK PERMISSIONS
   * ======================================================================== */

  const taskAdminRole = await knex('role')
    .select('role_id')
    .where({ name: 'task_admin', scope: 'task', record_end_date: null })
    .first();

  const taskUserRole = await knex('role')
    .select('role_id')
    .where({ name: 'task_user', scope: 'task', record_end_date: null })
    .first();

  if (taskAdminRole?.role_id) {
    await knex('task_permission').insert({ role_id: taskAdminRole.role_id });
  }

  if (taskUserRole?.role_id) {
    await knex('task_permission').insert({ role_id: taskUserRole.role_id });
  }

  /* ==========================================================================
   * PROFILES (from SEED_CONSTANTS)
   * ========================================================================== */

  const memberRole = await knex('role')
    .select('role_id')
    .where({ name: 'member', scope: 'system', record_end_date: null })
    .first();

  for (const profile of C.PROFILES) {
    await knex('profile')
      .insert({
      profile_guid: profile.profile_guid,
      profile_identifier: profile.profile_identifier,
      identity_source: profile.identity_source,
      role_id: memberRole?.role_id || null,
      display_name: profile.display_name,
      email: profile.email,
      given_name: profile.given_name,
      family_name: profile.family_name,
      agency: profile.agency,
      notes: profile.notes
      })
      .onConflict(['profile_guid'])
      .ignore();
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

  /* ==========================================================================
   * PROJECT PROFILES
   * ========================================================================== */

  const demoProfile = await knex('profile')
    .select('profile_id')
    .where({ profile_guid: 'demo-user', record_end_date: null })
    .first();

  const demoProject = await knex('project').select('project_id').where({ name: 'Demo Project' }).first();

  const projectPermission = await knex('project_permission')
    .select('project_permission_id')
    .whereIn('role_id', [projectAdminRole?.role_id || null])
    .first();

  if (demoProfile?.profile_id && demoProject?.project_id && projectPermission?.project_permission_id) {
    await knex('project_profile').insert({
      project_id: demoProject.project_id,
      profile_id: demoProfile.profile_id,
      project_permission_id: projectPermission.project_permission_id
    });
  }

  /* ==========================================================================
   * TASK PROFILES
   * ========================================================================== */

  const demoTask = await knex('task').select('task_id').where({ name: 'Demo Task' }).first();

  const taskPermission = await knex('task_permission')
    .select('task_permission_id')
    .whereIn('role_id', [taskAdminRole?.role_id || null])
    .first();

  if (demoProfile?.profile_id && demoTask?.task_id && taskPermission?.task_permission_id) {
    await knex('task_profile').insert({
      task_id: demoTask.task_id,
      profile_id: demoProfile.profile_id,
      task_permission_id: taskPermission.task_permission_id
    });
  }

  /* ==========================================================================
   * PROJECT TASKS
   * ========================================================================== */

  if (demoProject?.project_id && demoTask?.task_id) {
    await knex('project_task').insert({
      project_id: demoProject.project_id,
      task_id: demoTask.task_id
    });
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
