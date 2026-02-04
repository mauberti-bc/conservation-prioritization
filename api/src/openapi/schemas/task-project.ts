import { OpenAPIV3 } from 'openapi-types';

export const AddTaskProjectsSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['projectIds'],
  properties: {
    projectIds: {
      type: 'array',
      items: {
        type: 'string',
        format: 'uuid'
      },
      minItems: 1
    }
  }
};
