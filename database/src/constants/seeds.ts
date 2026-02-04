export const SEED_CONSTANTS = {
  TABLES_TO_CLEAR: [
    'audit_log',
    'role',
    'task_layer_constraint',
    'task_layer',
    'task_tile',
    'project_task',
    'task_profile',
    'task_permission',
    'task',
    'project_profile',
    'project_permission',
    'project'
  ],
  SYSTEM_ROLES: [
    {
      name: 'admin',
      description: 'System administrator role',
      scope: 'system'
    },
    {
      name: 'member',
      description: 'System member role',
      scope: 'system'
    }
  ],
  PROJECT_ROLES: [
    {
      name: 'project_admin',
      description: 'Project administrator role',
      scope: 'profile'
    },
    {
      name: 'project_user',
      description: 'Project user role',
      scope: 'profile'
    }
  ],
  TASK_ROLES: [
    {
      name: 'task_admin',
      description: 'Task administrator role',
      scope: 'task'
    },
    {
      name: 'task_user',
      description: 'Task user role',
      scope: 'task'
    }
  ],
  PROFILES: [
    {
      profile_guid: 'demo-user',
      profile_identifier: 'demo-user',
      identity_source: 'idir',
      display_name: 'Demo User',
      email: 'demo.user@example.com',
      given_name: 'Demo',
      family_name: 'User',
      agency: 'BC Government',
      notes: null
    }
  ],
  PROJECTS: [
    {
      name: 'Demo Project',
      description: 'Seeded project for local development'
    }
  ],
  TASKS: [
    {
      name: 'Demo Task',
      description: 'Seeded task for local development',
      status: 'pending'
    }
  ],
  TASK_LAYERS: [
    {
      layer_name: 'landcover/forest',
      description: 'Seeded layer',
      mode: 'flexible',
      importance: 0.8,
      threshold: null
    }
  ],
  TASK_LAYER_CONSTRAINTS: [
    {
      type: 'percent',
      min: 10,
      max: 90
    }
  ],
  TASK_TILES: [
    {
      status: 'DRAFT',
      uri: null,
      content_type: null
    }
  ]
} as const;
