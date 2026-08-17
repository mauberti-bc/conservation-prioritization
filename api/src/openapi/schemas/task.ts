import { OpenAPIV3 } from 'openapi-types';
import { GeoJSONFeature } from './geoJson';
import { TaskRunSchema } from './task-run';

const TargetAreaSchema: OpenAPIV3.SchemaObject = {
  oneOf: [
    GeoJSONFeature,
    {
      type: 'object',
      required: ['type', 'features'],
      additionalProperties: true,
      properties: {
        type: { type: 'string', enum: ['FeatureCollection'] },
        features: { type: 'array', minItems: 1, items: GeoJSONFeature }
      }
    }
  ],
  description: 'GeoJSON area from which eligible planning units are constructed.'
};

const ObjectiveSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['layer', 'direction'],
  additionalProperties: false,
  properties: {
    layer: { type: 'string' },
    direction: { type: 'string', enum: ['maximize', 'minimize'] },
    importance: { type: 'number', minimum: 0, default: 1 }
  }
};

const ConstraintSchema: OpenAPIV3.SchemaObject = {
  oneOf: [
    {
      type: 'object',
      required: ['type', 'layer'],
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['aggregate'] },
        layer: { type: 'string' },
        min: { type: 'number', nullable: true },
        max: { type: 'number', nullable: true }
      }
    },
    {
      type: 'object',
      required: ['type', 'layer'],
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['planning_unit'] },
        layer: { type: 'string' },
        min: { type: 'number', nullable: true },
        max: { type: 'number', nullable: true }
      }
    }
  ],
  discriminator: { propertyName: 'type' }
};

const NeighborPenaltySchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  nullable: true,
  required: ['strength'],
  additionalProperties: false,
  properties: {
    strength: { type: 'number', minimum: 0 }
  }
};

/** Request for creating an empty authoring draft. */
export const CreateTaskDraftSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      enum: ['continuous_optimization', 'discrete_optimization', 'priority_ranking'],
      default: 'discrete_optimization'
    },
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 500, nullable: true },
    resolution: { type: 'number', enum: [30, 60, 120, 240, 480, 960, 1920] },
    planning_unit_resolution: { type: 'number', enum: [30, 60, 120, 240, 480, 960, 1920] },
    resampling: { type: 'string', enum: ['mode', 'min', 'max'], nullable: true }
  }
};

/** Immutable mathematical optimization problem plus execution controls. */
export const SubmitTaskSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['target_area', 'objectives', 'constraints'],
  additionalProperties: false,
  properties: {
    target_area: TargetAreaSchema,
    objectives: { type: 'array', minItems: 1, items: ObjectiveSchema },
    constraints: { type: 'array', items: ConstraintSchema },
    neighbor_penalty: NeighborPenaltySchema,
    planning_unit_resolution: { type: 'number', enum: [30, 60, 120, 240, 480, 960, 1920] },
    resolution: { type: 'number', enum: [30, 60, 120, 240, 480, 960, 1920], nullable: true },
    resampling: { type: 'string', enum: ['mode', 'min', 'max'], nullable: true },
    optimization_mode: {
      type: 'string',
      enum: ['interactive', 'balanced', 'exact_audit'],
      default: 'interactive',
      nullable: true
    },
    export_selected_parquet: { type: 'boolean' }
  }
};

/** Public task metadata and its latest immutable run. */
export const GetTaskSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['task_id', 'type', 'name', 'status'],
  additionalProperties: true,
  properties: {
    task_id: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: ['continuous_optimization', 'discrete_optimization', 'priority_ranking'] },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    resolution: { type: 'number', nullable: true },
    resampling: { type: 'string', enum: ['mode', 'min', 'max'], nullable: true },
    tileset_uri: { type: 'string', nullable: true },
    output_uri: { type: 'string', nullable: true },
    status: {
      type: 'string',
      enum: ['draft', 'pending', 'submitted', 'running', 'completed', 'failed', 'failed_to_submit']
    },
    status_message: { type: 'string', nullable: true },
    latest_run: { ...TaskRunSchema, nullable: true, additionalProperties: true }
  }
};

/** Editable task metadata; mathematical content is submitted only as an immutable run. */
export const UpdateTaskSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['continuous_optimization', 'discrete_optimization', 'priority_ranking'] },
    name: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 500, nullable: true },
    resolution: { type: 'number', enum: [30, 60, 120, 240, 480, 960, 1920], nullable: true },
    resampling: { type: 'string', enum: ['mode', 'min', 'max'], nullable: true },
    status: {
      type: 'string',
      enum: ['draft', 'pending', 'submitted', 'running', 'completed', 'failed', 'failed_to_submit']
    }
  }
};

/** Internal lifecycle update. */
export const TaskStatusUpdateSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['status'],
  properties: {
    status: {
      type: 'string',
      enum: ['draft', 'pending', 'submitted', 'running', 'completed', 'failed', 'failed_to_submit']
    },
    message: { type: 'string', nullable: true },
    output_uri: { type: 'string', nullable: true }
  }
};
