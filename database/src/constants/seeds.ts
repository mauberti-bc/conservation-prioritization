export const SEED_CONSTANTS = {
  TABLES_TO_CLEAR: [
    'audit_log',
    'artifact',
    'task_run_solution',
    'task_run',
    'task_tile',
    'project_task',
    'task_profile',
    'task_permission',
    'task',
    'project_profile',
    'project_permission',
    'project'
  ],
  PROJECTS: [
    {
      name: 'Coastal Habitat Restoration',
      description: 'Prioritizes shoreline habitats and estuaries for restoration planning.',
      colour: '#2f9f90'
    },
    {
      name: 'Interior Forest Connectivity',
      description: 'Focuses on maintaining wildlife corridors across interior forest landscapes.',
      colour: '#6f7fd9'
    },
    {
      name: 'Watershed Resilience',
      description: 'Evaluates conservation targets for headwater protection and flood resilience.',
      colour: '#d47f42'
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
  TASK_TILES: [
    {
      status: 'DRAFT',
      pmtiles_uri: null,
      content_type: null
    }
  ]
} as const;
