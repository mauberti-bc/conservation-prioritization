import { OpenAPIV3 } from 'openapi-types';

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
      maxLength: 500
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
  required: ['task_id', 'name', 'description', 'layers'],
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
