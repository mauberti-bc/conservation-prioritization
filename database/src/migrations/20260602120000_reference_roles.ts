import { Knex } from 'knex';

const REFERENCE_ROLES = [
  {
    name: 'admin',
    description: 'Project administrator role',
    scope: 'project'
  },
  {
    name: 'member',
    description: 'Project user role',
    scope: 'project'
  },
  {
    name: 'admin',
    description: 'Profile administrator role',
    scope: 'profile'
  },
  {
    name: 'member',
    description: 'Profile member role',
    scope: 'profile'
  },
  {
    name: 'admin',
    description: 'Task administrator role',
    scope: 'task'
  },
  {
    name: 'member',
    description: 'Task user role',
    scope: 'task'
  },
  {
    name: 'admin',
    description: 'Dashboard administrator role',
    scope: 'dashboard'
  },
  {
    name: 'member',
    description: 'Dashboard member role',
    scope: 'dashboard'
  }
] as const;

/**
 * Insert stable role reference data required by application authorization.
 *
 * @param {Knex} knex - Knex database client.
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;
  `);

  for (const role of REFERENCE_ROLES) {
    await knex.raw(
      `
        INSERT INTO role (name, description, scope)
        SELECT ?, ?, ?::role_scope
        WHERE NOT EXISTS (
          SELECT 1
          FROM role
          WHERE name = ?
            AND scope = ?::role_scope
            AND record_end_date IS NULL
        );
      `,
      [role.name, role.description, role.scope, role.name, role.scope]
    );
  }
}

/**
 * End-date active role reference data inserted by this migration.
 *
 * @param {Knex} knex - Knex database client.
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=conservation,public;
  `);

  for (const role of REFERENCE_ROLES) {
    await knex.raw(
      `
        UPDATE role
        SET record_end_date = now()
        WHERE name = ?
          AND scope = ?::role_scope
          AND record_end_date IS NULL;
      `,
      [role.name, role.scope]
    );
  }
}
