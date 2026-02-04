import { OpenAPIV3 } from 'openapi-types';

export const DashboardSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['dashboard_id', 'public_id', 'name', 'access_scheme', 'task_ids', 'dashboard_url'],
  properties: {
    dashboard_id: {
      type: 'string',
      format: 'uuid'
    },
    public_id: {
      type: 'string',
      format: 'uuid'
    },
    name: {
      type: 'string'
    },
    description: {
      type: 'string',
      nullable: true
    },
    access_scheme: {
      type: 'string',
      enum: ['ANYONE_WITH_LINK', 'MEMBERS_ONLY', 'NOBODY']
    },
    created_at: {
      type: 'string',
      nullable: true
    },
    created_by: {
      type: 'string',
      format: 'uuid',
      nullable: true
    },
    task_ids: {
      type: 'array',
      items: {
        type: 'string',
        format: 'uuid'
      }
    },
    dashboard_url: {
      type: 'string'
    }
  }
};
