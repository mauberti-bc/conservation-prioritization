import { z } from 'zod';
import { TaskType } from './task';

export type TaskRunExecutionMethod =
  | 'compiled_continuous_optimization'
  | 'compiled_discrete_optimization'
  | 'compiled_priority_ranking';

export const TaskRunStatus = z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']);
export type TaskRunStatus = z.infer<typeof TaskRunStatus>;

export const TaskRunExecutionMethodSchema = z.preprocess(
  (value) => (value === 'compiled_optimization' ? 'compiled_discrete_optimization' : value),
  z.enum(['compiled_continuous_optimization', 'compiled_discrete_optimization', 'compiled_priority_ranking'])
);

export const TaskRunStage = z.enum([
  'counting',
  'preparing',
  'admitting',
  'compiling',
  'solving',
  'materializing',
  'exporting',
  'publishing'
]);
export type TaskRunStage = z.infer<typeof TaskRunStage>;

/** Immutable execution of a task scenario. */
export const TaskRun = z.object({
  task_run_id: z.string().uuid(),
  task_id: z.string().uuid(),
  task_type: TaskType,
  analytical_source_id: z.string().uuid().nullable(),
  execution_method: TaskRunExecutionMethodSchema,
  execution_method_version: z.string(),
  status: TaskRunStatus,
  stage: TaskRunStage.nullable(),
  revision: z.coerce.number().int(),
  input_snapshot: z.record(z.unknown()),
  input_hash: z.string(),
  planning_unit_definition: z.record(z.unknown()),
  solver_config: z.record(z.unknown()),
  code_version: z.string().nullable(),
  solver_name: z.string().nullable(),
  solver_version: z.string().nullable(),
  solver_status: z.string().nullable(),
  objective_value: z.coerce.number().nullable(),
  optimality_gap: z.coerce.number().nullable(),
  runtime_seconds: z.coerce.number().nullable(),
  preliminary_estimate: z.record(z.unknown()).nullable(),
  admission_outcome: z.record(z.unknown()).nullable(),
  progress: z.record(z.unknown()).nullable(),
  planning_unit_count: z.coerce.number().int().nullable(),
  feature_nonzero_count: z.coerce.number().int().nullable(),
  neighbor_edge_count: z.coerce.number().int().nullable(),
  prefect_flow_run_id: z.string().uuid().nullable(),
  prefect_deployment_id: z.string().uuid().nullable(),
  dispatch_attempts: z.number().int(),
  failure_code: z.string().nullable(),
  failure_message: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  failed_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable()
});

export type TaskRun = z.infer<typeof TaskRun>;

export interface CreateTaskRun {
  task_id: string;
  task_type: TaskType;
  analytical_source_id: string | null;
  execution_method: TaskRunExecutionMethod;
  execution_method_version: string;
  input_snapshot: Record<string, unknown>;
  input_hash: string;
  planning_unit_definition: Record<string, unknown>;
  solver_config: Record<string, unknown>;
  code_version: string | null;
}

export interface UpdateTaskRun {
  status?: TaskRunStatus;
  stage?: TaskRunStage | null;
  solver_status?: string | null;
  solver_name?: string | null;
  solver_version?: string | null;
  objective_value?: number | null;
  optimality_gap?: number | null;
  runtime_seconds?: number | null;
  preliminary_estimate?: Record<string, unknown> | null;
  admission_outcome?: Record<string, unknown> | null;
  progress?: Record<string, unknown> | null;
  planning_unit_count?: number | null;
  feature_nonzero_count?: number | null;
  neighbor_edge_count?: number | null;
  prefect_flow_run_id?: string | null;
  prefect_deployment_id?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
}
