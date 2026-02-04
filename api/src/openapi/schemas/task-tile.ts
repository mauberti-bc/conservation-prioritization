import { OpenAPIV3 } from 'openapi-types';

export const TaskTileSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['task_tile_id', 'task_id', 'status'],
  properties: {
    task_tile_id: {
      type: 'string',
      format: 'uuid',
      description: 'The ID of the task tile.'
    },
    task_id: {
      type: 'string',
      format: 'uuid',
      description: 'The ID of the task.'
    },
    status: {
      type: 'string',
      enum: ['DRAFT', 'STARTED', 'COMPLETED', 'FAILED'],
      description: 'Status of the tiling job.'
    },
    uri: {
      type: 'string',
      nullable: true,
      description: 'URI for the generated PMTiles archive.'
    },
    content_type: {
      type: 'string',
      nullable: true,
      description: 'Content type for the PMTiles artifact.'
    },
    error_code: {
      type: 'string',
      nullable: true,
      description: 'Optional error code for tiling failures.'
    },
    error_message: {
      type: 'string',
      nullable: true,
      description: 'Optional error message for tiling failures.'
    }
  }
};

export const TaskTileStatusUpdateSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['status'],
  properties: {
    status: {
      type: 'string',
      enum: ['DRAFT', 'STARTED', 'COMPLETED', 'FAILED'],
      description: 'Updated task tile status.'
    },
    uri: {
      type: 'string',
      nullable: true,
      description: 'URI for the generated PMTiles archive.'
    },
    content_type: {
      type: 'string',
      nullable: true,
      description: 'Content type for the PMTiles artifact.'
    },
    error_code: {
      type: 'string',
      nullable: true,
      description: 'Optional error code for tiling failures.'
    },
    error_message: {
      type: 'string',
      nullable: true,
      description: 'Optional error message for tiling failures.'
    }
  }
};
