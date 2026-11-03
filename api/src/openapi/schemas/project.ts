import { OpenAPIV3 } from 'openapi-types';

/**
 * OpenAPI Schema for creating a project.
 */
export const CreateProjectSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Project name.'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Project description.'
    },
    colour: {
      type: 'string',
      maxLength: 7,
      description: 'Hex colour code for the project.'
    }
  }
};

/**
 * OpenAPI Schema for a project.
 */
export const GetProjectSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['project_id', 'name', 'description', 'colour'],
  properties: {
    project_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the project.'
    },
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Project name.'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Project description.'
    },
    colour: {
      type: 'string',
      maxLength: 7,
      description: 'Hex colour code for the project.'
    }
  }
};

/**
 * OpenAPI Schema for updating a project.
 */
export const UpdateProjectSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Project name.'
    },
    description: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Project description.'
    },
    colour: {
      type: 'string',
      maxLength: 7,
      description: 'Hex colour code for the project.'
    }
  }
};
