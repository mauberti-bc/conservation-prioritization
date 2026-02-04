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
      name: 'admin',
      description: 'Project administrator role',
      scope: 'profile'
    },
    {
      name: 'member',
      description: 'Project user role',
      scope: 'profile'
    }
  ],
  TASK_ROLES: [
    {
      name: 'admin',
      description: 'Task administrator role',
      scope: 'task'
    },
    {
      name: 'member',
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
      notes: null,
      system_role: 'member'
    },
    {
      profile_guid: '62EC624E50844486A046DC9709854F8D',
      profile_identifier: 'mauberti',
      identity_source: 'idir',
      display_name: 'mauberti',
      email: null,
      given_name: null,
      family_name: null,
      agency: null,
      notes: null,
      system_role: 'admin'
    }
  ],
  PROJECTS: [
    {
      name: 'Coastal Habitat Restoration',
      description: 'Prioritizes shoreline habitats and estuaries for restoration planning.'
    },
    {
      name: 'Interior Forest Connectivity',
      description: 'Focuses on maintaining wildlife corridors across interior forest landscapes.'
    },
    {
      name: 'Watershed Resilience',
      description: 'Evaluates conservation targets for headwater protection and flood resilience.'
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
