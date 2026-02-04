import { OpenAPIV3 } from 'openapi-types';
import { GeoJSONFeature } from './geoJson';

/**
 * OpenAPI Schema for creating a task.
 */
export const CreateTaskSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['name', 'description', 'layers'],
  properties: {
    name: {
      type: 'string',
      description: 'The name of the task.',
      maxLength: 100
    },
    description: {
      type: 'string',
      description: 'A description of the task.',
      maxLength: 500,
      nullable: true
    },
    resolution: {
      type: 'number',
      description: 'Resolution for the task.'
    },
    resampling: {
      type: 'string',
      description: 'Resampling method for the task.',
      enum: ['mode', 'min', 'max']
    },
    target_area: {
      type: 'number',
      description: 'Target area for optimization (percentage or absolute).'
    },
    is_percentage: {
      type: 'boolean',
      description: 'Whether target_area is a percentage.',
      default: true
    },
    geometry: {
      type: 'array',
      description: 'Optional geometries to constrain the analysis area.',
      items: {
        type: 'object',
        required: ['geojson'],
        properties: {
          name: {
            type: 'string',
            maxLength: 100,
            description: 'Optional geometry name.'
          },
          description: {
            type: 'string',
            maxLength: 500,
            nullable: true,
            description: 'Optional geometry description.'
          },
          geojson: GeoJSONFeature
        }
      }
    },
    variant: {
      type: 'string',
      description: 'Optimization variant for the task.',
      enum: ['strict', 'approximate']
    },
    layers: {
      type: 'array',
      description: 'List of layers associated with the task.',
      items: {
        type: 'object',
        required: ['layer_name', 'mode', 'constraints'],
        properties: {
          layer_name: {
            type: 'string',
            description: 'The name of the layer.'
          },
          description: {
            type: 'string',
            description: 'A description of the layer.',
            nullable: true
          },
          mode: {
            type: 'string',
            description: 'Configured mode for the task layer.',
            enum: ['flexible', 'locked-in', 'locked-out']
          },
          importance: {
            type: 'number',
            nullable: true,
            description: 'Relative importance when mode is flexible.'
          },
          threshold: {
            type: 'number',
            nullable: true,
            description: 'Threshold when mode is locked-in or locked-out.'
          },
          constraints: {
            type: 'array',
            description: 'List of constraints for the task layer.',
            items: {
              type: 'object',
              required: ['type'],
              properties: {
                type: {
                  type: 'string',
                  description: 'Constraint type.',
                  enum: ['percent', 'unit']
                },
                min: {
                  type: 'number',
                  nullable: true,
                  description: 'Minimum constraint value.'
                },
                max: {
                  type: 'number',
                  nullable: true,
                  description: 'Maximum constraint value.'
                }
              }
            }
          }
        }
      }
    },
    budget: {
      type: 'object',
      description: 'Optional budget layer configuration.',
      required: ['layer_name', 'mode', 'constraints'],
      properties: {
        layer_name: {
          type: 'string',
          description: 'The name of the layer.'
        },
        description: {
          type: 'string',
          description: 'A description of the layer.',
          nullable: true
        },
        mode: {
          type: 'string',
          description: 'Configured mode for the task layer.',
          enum: ['flexible', 'locked-in', 'locked-out']
        },
        importance: {
          type: 'number',
          nullable: true,
          description: 'Relative importance when mode is flexible.'
        },
        threshold: {
          type: 'number',
          nullable: true,
          description: 'Threshold when mode is locked-in or locked-out.'
        },
        constraints: {
          type: 'array',
          description: 'List of constraints for the task layer.',
          items: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                description: 'Constraint type.',
                enum: ['percent', 'unit']
              },
              min: {
                type: 'number',
                nullable: true,
                description: 'Minimum constraint value.'
              },
              max: {
                type: 'number',
                nullable: true,
                description: 'Maximum constraint value.'
              }
            }
          }
        }
      }
    }
  }
};

/**
 * OpenAPI Schema for the response when getting a task.
 */
export const GetTaskSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['task_id', 'name', 'description', 'status', 'layers', 'geometries'],
  properties: {
    task_id: {
      type: 'string',
      format: 'uuid',
      description: 'The ID of the task.'
    },
    name: {
      type: 'string',
      description: 'The name of the task.'
    },
    description: {
      type: 'string',
      description: 'A description of the task.'
    },
    tileset_uri: {
      type: 'string',
      nullable: true,
      description: 'URI for the latest tileset artifact.'
    },
    output_uri: {
      type: 'string',
      nullable: true,
      description: 'URI for the strict optimization output artifact.'
    },
    status: {
      type: 'string',
      description: 'Execution status for the task lifecycle.',
      enum: ['draft', 'pending', 'submitted', 'running', 'completed', 'failed', 'failed_to_submit']
    },
    status_message: {
      type: 'string',
      nullable: true,
      description: 'Optional status message for diagnostics.'
    },
    prefect_flow_run_id: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Prefect flow run ID associated with the task.'
    },
    prefect_deployment_id: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Prefect deployment ID used to launch the task.'
    },
    geometries: {
      type: 'array',
      description: 'Geometries associated with the task.',
      items: {
        type: 'object',
        required: ['geometry_id', 'name', 'geojson'],
        properties: {
          geometry_id: {
            type: 'string',
            format: 'uuid',
            description: 'The ID of the geometry.'
          },
          name: {
            type: 'string',
            description: 'Geometry name.'
          },
          description: {
            type: 'string',
            nullable: true,
            description: 'Geometry description.'
          },
          geojson: GeoJSONFeature
        }
      }
    },
    layers: {
      type: 'array',
      description: 'List of layers associated with the task.',
      items: {
        type: 'object',
        required: ['task_layer_id', 'task_id', 'layer_name', 'mode', 'constraints'],
        properties: {
          task_layer_id: {
            type: 'string',
            format: 'uuid',
            description: 'The ID of the task layer.'
          },
          task_id: {
            type: 'string',
            format: 'uuid',
            description: 'The ID of the task.'
          },
          layer_name: {
            type: 'string',
            description: 'The name of the layer.'
          },
          description: {
            type: 'string',
            description: 'A description of the layer.',
            nullable: true
          },
          mode: {
            type: 'string',
            description: 'Configured mode for the task layer.',
            enum: ['flexible', 'locked-in', 'locked-out']
          },
          importance: {
            type: 'number',
            nullable: true,
            description: 'Relative importance when mode is flexible.'
          },
          threshold: {
            type: 'number',
            nullable: true,
            description: 'Threshold when mode is locked-in or locked-out.'
          },
          constraints: {
            type: 'array',
            description: 'List of constraints for the task layer.',
            items: {
              type: 'object',
              required: ['task_layer_constraint_id', 'task_layer_id', 'type'],
              properties: {
                task_layer_constraint_id: {
                  type: 'string',
                  format: 'uuid',
                  description: 'The ID of the task layer constraint.'
                },
                task_layer_id: {
                  type: 'string',
                  format: 'uuid',
                  description: 'The ID of the task layer.'
                },
                type: {
                  type: 'string',
                  description: 'Constraint type.',
                  enum: ['percent', 'unit']
                },
                min: {
                  type: 'number',
                  nullable: true,
                  description: 'Minimum constraint value.'
                },
                max: {
                  type: 'number',
                  nullable: true,
                  description: 'Maximum constraint value.'
                }
              }
            }
          }
        }
      }
    },
    projects: {
      type: 'array',
      description: 'Projects associated with the task.',
      items: {
        type: 'object',
        required: ['project_id', 'name', 'description', 'colour'],
        properties: {
          project_id: {
            type: 'string',
            format: 'uuid',
            description: 'Project ID.'
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
            description: 'Hex colour code.'
          }
        }
      }
    }
  }
};

/**
 * OpenAPI Schema for updating a task.
 */
export const UpdateTaskSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [],
  properties: {
    name: {
      type: 'string',
      description: 'The name of the task.',
      maxLength: 100
    },
    description: {
      type: 'string',
      description: 'A description of the task.',
      maxLength: 500
    },
    layers: {
      type: 'array',
      description: 'List of layers associated with the task.',
      items: {
        type: 'object',
        required: ['task_layer_id', 'task_id', 'layer_name', 'mode', 'constraints'],
        properties: {
          task_layer_id: {
            type: 'string',
            format: 'uuid',
            description: 'The ID of the task layer.'
          },
          task_id: {
            type: 'string',
            format: 'uuid',
            description: 'The ID of the task.'
          },
          layer_name: {
            type: 'string',
            description: 'The name of the layer.'
          },
          description: {
            type: 'string',
            description: 'A description of the layer.',
            nullable: true
          },
          mode: {
            type: 'string',
            description: 'Configured mode for the task layer.',
            enum: ['flexible', 'locked-in', 'locked-out']
          },
          importance: {
            type: 'number',
            nullable: true,
            description: 'Relative importance when mode is flexible.'
          },
          threshold: {
            type: 'number',
            nullable: true,
            description: 'Threshold when mode is locked-in or locked-out.'
          },
          constraints: {
            type: 'array',
            description: 'List of constraints for the task layer.',
            items: {
              type: 'object',
              required: ['task_layer_constraint_id', 'task_layer_id', 'type'],
              properties: {
                task_layer_constraint_id: {
                  type: 'string',
                  format: 'uuid',
                  description: 'The ID of the task layer constraint.'
                },
                task_layer_id: {
                  type: 'string',
                  format: 'uuid',
                  description: 'The ID of the task layer.'
                },
                type: {
                  type: 'string',
                  description: 'Constraint type.',
                  enum: ['percent', 'unit']
                },
                min: {
                  type: 'number',
                  nullable: true,
                  description: 'Minimum constraint value.'
                },
                max: {
                  type: 'number',
                  nullable: true,
                  description: 'Maximum constraint value.'
                }
              }
            }
          }
        }
      }
    }
  }
};

/**
 * OpenAPI Schema for internal task status updates.
 */
export const TaskStatusUpdateSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['status'],
  properties: {
    status: {
      type: 'string',
      description: 'Updated task status.',
      enum: ['draft', 'pending', 'submitted', 'running', 'completed', 'failed', 'failed_to_submit']
    },
    message: {
      type: 'string',
      nullable: true,
      description: 'Optional status message for diagnostics.'
    },
    output_uri: {
      type: 'string',
      nullable: true,
      description: 'URI for the strict optimization output artifact.'
    }
  }
};
