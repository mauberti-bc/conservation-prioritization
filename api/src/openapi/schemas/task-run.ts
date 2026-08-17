import { OpenAPIV3 } from 'openapi-types';

export const TaskRunSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'task_run_id',
    'task_id',
    'task_type',
    'execution_method',
    'execution_method_version',
    'status',
    'revision',
    'input_snapshot',
    'input_hash',
    'artifacts',
    'solutions'
  ],
  properties: {
    task_run_id: { type: 'string', format: 'uuid' },
    task_id: { type: 'string', format: 'uuid' },
    task_type: { type: 'string', enum: ['continuous_optimization', 'discrete_optimization', 'priority_ranking'] },
    analytical_source_id: { type: 'string', format: 'uuid', nullable: true },
    execution_method: {
      type: 'string',
      enum: ['compiled_continuous_optimization', 'compiled_discrete_optimization', 'compiled_priority_ranking']
    },
    execution_method_version: { type: 'string' },
    status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed', 'cancelled'] },
    stage: {
      type: 'string',
      enum: ['counting', 'preparing', 'admitting', 'compiling', 'solving', 'materializing', 'exporting', 'publishing'],
      nullable: true
    },
    revision: { type: 'integer' },
    input_snapshot: { type: 'object', additionalProperties: true },
    input_hash: { type: 'string' },
    planning_unit_definition: { type: 'object', additionalProperties: true },
    solver_config: { type: 'object', additionalProperties: true },
    code_version: { type: 'string', nullable: true },
    solver_name: { type: 'string', nullable: true },
    solver_version: { type: 'string', nullable: true },
    solver_status: { type: 'string', nullable: true },
    objective_value: { type: 'number', nullable: true },
    optimality_gap: { type: 'number', nullable: true },
    runtime_seconds: { type: 'number', nullable: true },
    preliminary_estimate: { type: 'object', additionalProperties: true, nullable: true },
    admission_outcome: { type: 'object', additionalProperties: true, nullable: true },
    progress: { type: 'object', additionalProperties: true, nullable: true },
    planning_unit_count: { type: 'integer', format: 'int64', nullable: true },
    feature_nonzero_count: { type: 'integer', format: 'int64', nullable: true },
    neighbor_edge_count: { type: 'integer', format: 'int64', nullable: true },
    prefect_flow_run_id: { type: 'string', format: 'uuid', nullable: true },
    prefect_deployment_id: { type: 'string', format: 'uuid', nullable: true },
    dispatch_attempts: { type: 'integer' },
    failure_code: { type: 'string', nullable: true },
    failure_message: { type: 'string', nullable: true },
    artifacts: {
      type: 'array',
      items: { type: 'object', additionalProperties: true }
    },
    solutions: {
      type: 'array',
      items: { type: 'object', additionalProperties: true }
    }
  }
};
