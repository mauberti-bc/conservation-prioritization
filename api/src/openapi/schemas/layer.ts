import { OpenAPIV3 } from 'openapi-types';

/**
 * OpenAPI schema for a layer's metadata.
 */
export const LayerMetaSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['group', 'path', 'name', 'shape', 'dtype'],
  properties: {
    group: {
      type: 'string',
      description: 'Parent grouping path for the layer.'
    },
    path: {
      type: 'string',
      description: 'Full array path for the layer.'
    },
    name: {
      type: 'string',
      description: 'Display name for the layer.'
    },
    description: {
      type: 'string',
      description: 'Optional description of the layer.',
      nullable: true
    },
    shape: {
      type: 'array',
      description: 'Array shape from Zarr metadata.',
      items: {
        type: 'number'
      }
    },
    dtype: {
      type: 'string',
      description: 'Data type string from Zarr metadata.'
    }
  }
};
