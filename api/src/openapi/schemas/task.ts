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
    layers: {
      type: 'array',
      description: 'List of layers associated with the task.',
      items: {
        type: 'object',
        required: ['task_layer_id', 'task_id', 'layer_name', 'description', 'constraints'],
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
            description: 'A description of the layer.'
          },
          constraints: {
            type: 'array',
            description: 'List of constraints for the task layer.',
            items: {
              type: 'object',
              required: ['task_layer_constraint_id', 'task_layer_id', 'constraint_name', 'constraint_value'],
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
                constraint_name: {
                  type: 'string',
                  description: 'The name of the constraint.'
                },
                constraint_value: {
                  type: 'string',
                  description: 'The value of the constraint.'
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
        required: ['task_layer_id', 'task_id', 'layer_name', 'description', 'constraints'],
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
            description: 'A description of the layer.'
          },
          constraints: {
            type: 'array',
            description: 'List of constraints for the task layer.',
            items: {
              type: 'object',
              required: ['task_layer_constraint_id', 'task_layer_id', 'constraint_name', 'constraint_value'],
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
                constraint_name: {
                  type: 'string',
                  description: 'The name of the constraint.'
                },
                constraint_value: {
                  type: 'string',
                  description: 'The value of the constraint.'
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
        required: ['task_layer_id', 'task_id', 'layer_name', 'description', 'constraints'],
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
            description: 'A description of the layer.'
          },
          constraints: {
            type: 'array',
            description: 'List of constraints for the task layer.',
            items: {
              type: 'object',
              required: ['task_layer_constraint_id', 'task_layer_id', 'constraint_name', 'constraint_value'],
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
                constraint_name: {
                  type: 'string',
                  description: 'The name of the constraint.'
                },
                constraint_value: {
                  type: 'string',
                  description: 'The value of the constraint.'
                }
              }
            }
          }
        }
      }
    }
  }
};
