import { OpenAPIV3 } from 'openapi-types';

export const AddProjectTasksSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['taskIds'],
  properties: {
    taskIds: {
      type: 'array',
      items: {
        type: 'string',
        format: 'uuid'
      },
      minItems: 1
    }
  }
};
