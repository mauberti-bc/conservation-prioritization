import { TaskStatusValue } from 'constants/status';
import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import { ApiPaginationResponseParams } from 'types/pagination';
import { DashboardAccessScheme, DashboardResponse } from './useDashboardApi.interface';

export enum OPTIMIZATION_MODE {
  INTERACTIVE = 'interactive',
  BALANCED = 'balanced',
  EXACT_AUDIT = 'exact_audit',
}

export type TASK_TYPE = 'continuous_optimization' | 'discrete_optimization' | 'priority_ranking';

export type RESAMPLING = 'mode' | 'min' | 'max';
/**
 * Request interface for creating a draft task.
 */
export interface CreateDraftTaskRequest {
  type?: TASK_TYPE;
  name: string;
  description: string | null;
  resolution?: number;
  planning_unit_resolution?: number;
  resampling?: RESAMPLING;
}

/**
 * Request interface for submitting an existing draft task.
 */
export interface SubmitTaskRequest {
  optimization_mode?: OPTIMIZATION_MODE | null;
  target_area:
    | Feature<Geometry, GeoJsonProperties>
    | {
        type: 'FeatureCollection';
        features: Feature<Geometry, GeoJsonProperties>[];
      };
  objectives: OptimizationObjectiveRequest[];
  constraints: OptimizationConstraintRequest[];
  resolution?: number | null;
  planning_unit_resolution?: number | null;
  resampling?: RESAMPLING | null;
  neighbor_penalty?: NeighborPenaltyRequest | null;
  export_selected_parquet?: boolean;
}

export interface OptimizationObjectiveRequest {
  layer: string;
  direction: 'maximize' | 'minimize';
  importance?: number;
}

export type OptimizationConstraintRequest = {
  type: 'aggregate' | 'planning_unit';
  layer: string;
  min?: number | null;
  max?: number | null;
};

export interface NeighborPenaltyRequest {
  strength: number;
}

export interface UpdateTaskRequest {
  type?: TASK_TYPE;
  name?: string;
  description?: string | null;
  resolution?: number | null;
  resampling?: RESAMPLING | null;
  status?: TaskStatusValue;
}

/**
 * Response interface for a task (including layers and constraints).
 */

export interface GetTaskResponse {
  task_id: string; // UUID of the task
  type: TASK_TYPE;
  name: string; // Name of the task
  description: string | null; // Description of the task
  dashboard_id?: string | null;
  projects?: {
    project_id: string;
    name: string;
    description: string | null;
    colour: string;
  }[];
  status: TaskStatusValue;
  status_message?: string | null;
  prefect_flow_run_id?: string | null;
  prefect_deployment_id?: string | null;
  tileset_uri?: string | null;
  record_effective_date?: string; // ISO string of record effective date
  record_end_date?: string | null; // ISO string of record end date or null
  resolution?: number;
  resampling?: RESAMPLING;
  latest_run?: TaskRunResponse | null;
}

export interface TaskRunResponse {
  task_run_id: string;
  task_id: string;
  task_type: TASK_TYPE;
  execution_method: 'compiled_continuous_optimization' | 'compiled_discrete_optimization' | 'compiled_priority_ranking';
  execution_method_version: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  stage:
    | 'counting'
    | 'preparing'
    | 'admitting'
    | 'compiling'
    | 'solving'
    | 'materializing'
    | 'exporting'
    | 'publishing'
    | null;
  revision: number;
  input_snapshot?: TaskRunInputSnapshot;
  planning_unit_definition?: Record<string, unknown>;
  preliminary_estimate?: Record<string, unknown> | null;
  admission_outcome?: Record<string, unknown> | null;
  progress?: Record<string, unknown> | null;
  planning_unit_count?: number | null;
  feature_nonzero_count?: number | null;
  neighbor_edge_count?: number | null;
  solver_status?: string | null;
  solver_name?: string | null;
  solver_version?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  artifacts?: TaskRunArtifactResponse[];
  solutions?: TaskRunSolutionResponse[];
}

export interface TaskRunSolutionResponse {
  task_run_solution_id: string;
  solution_index: number;
  role: 'reference';
  status: string;
  objective_value?: number | null;
  resource_value?: number | null;
  selected_planning_unit_count?: number | null;
  optimality_gap?: number | null;
  solver_name?: string | null;
  solver_version?: string | null;
  runtime_seconds?: number | null;
  tileset_uri?: string | null;
  metrics: Record<string, unknown>;
}

export interface TaskRunInputSnapshot {
  schema_version?: number;
  task_type?: TASK_TYPE;
  decision_domain?: 'continuous' | 'discrete';
  optimization_mode?: OPTIMIZATION_MODE;
  work_budget?: Record<string, unknown>;
  target_area?: SubmitTaskRequest['target_area'];
  objectives?: OptimizationObjectiveRequest[];
  constraints?: OptimizationConstraintRequest[];
  resampling?: RESAMPLING;
  planning_unit_resolution?: number;
  neighbor_penalty?: NeighborPenaltyRequest | null;
  export_selected_parquet?: boolean;
  evidence_resolution?: {
    minimum: number;
    maximum: number;
    by_layer: Record<string, number>;
  };
  layer_contracts?: Record<string, TaskRunSnapshotLayer['representation_contract']>;
}

export interface TaskRunSnapshotLayer {
  layer_name: string;
  representation_contract?: {
    native_resolution?: number;
    coarse_to_fine_policy?: string;
    compatibility_mode?: 'legacy_noncanonical';
  };
}

export interface TaskRunArtifactResponse {
  artifact_id: string;
  type: string;
  status: 'pending' | 'building' | 'ready' | 'failed';
  uri?: string | null;
  content_type?: string | null;
  checksum?: string | null;
  manifest?: Record<string, unknown> | null;
  lineage?: Record<string, unknown>;
}

/**
 * Response interface for a paginated task list.
 */
export interface GetTasksResponse {
  tasks: GetTaskResponse[];
  pagination: ApiPaginationResponseParams;
}

/**
 * Request interface for updating task execution status.
 */
export interface UpdateTaskStatusRequest {
  status: TaskStatusValue;
  message?: string | null;
}

/**
 * Request interface for publishing a task to a dashboard.
 */
export interface PublishDashboardRequest {
  name: string;
  access_scheme: DashboardAccessScheme;
}

/**
 * Response interface for dashboard publish operations.
 */
export interface PublishDashboardResponse extends DashboardResponse {}

export interface GetTaskDashboardResponse extends DashboardResponse {}
