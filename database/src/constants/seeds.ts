import { SYSTEM_ROLE } from './profile';

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
  DASHBOARD_ROLES: [
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
  ],
  PROFILES: [
    {
      profile_guid: '62ec624e50844486a046dc9709854f8d@azureidir',
      profile_identifier: 'MAUBERTI',
      identity_source: 'azureidir',
      display_name: 'mauberti',
      email: null,
      given_name: null,
      family_name: null,
      agency: null,
      notes: null,
      system_role: SYSTEM_ROLE.ADMIN
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
      name: 'Coastal Priorities',
      description: 'Seeded task: coastal habitats and estuaries.',
      status: 'pending'
    },
    {
      name: 'Interior Corridors',
      description: 'Seeded task: interior connectivity corridors.',
      status: 'pending'
    },
    {
      name: 'Watershed Buffers',
      description: 'Seeded task: riparian buffer prioritization.',
      status: 'pending'
    },
    {
      name: 'Old Growth Refugia',
      description: 'Seeded task: old growth persistence areas.',
      status: 'pending'
    },
    {
      name: 'Wetland Integrity',
      description: 'Seeded task: wetland condition and services.',
      status: 'pending'
    },
    {
      name: 'Fire Risk Mitigation',
      description: 'Seeded task: fuel reduction priority zones.',
      status: 'pending'
    },
    {
      name: 'Species Richness',
      description: 'Seeded task: biodiversity hotspots.',
      status: 'pending'
    },
    {
      name: 'Carbon Storage',
      description: 'Seeded task: high carbon stock areas.',
      status: 'pending'
    },
    {
      name: 'Urban Edge Protection',
      description: 'Seeded task: urban interface conservation.',
      status: 'pending'
    },
    {
      name: 'Floodplain Resilience',
      description: 'Seeded task: floodplain function restoration.',
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
