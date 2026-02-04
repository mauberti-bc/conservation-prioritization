import { TaskStatusValue } from 'constants/status';
import { DashboardAccessScheme, DashboardResponse } from './useDashboardApi.interface';

export enum OPTIMIZATION_VARIANT {
  STRICT = 'strict',
  APPROXIMATE = 'approximate',
}

export type RESAMPLING = 'mode' | 'min' | 'max';
/**
 * Interface representing a constraint for a task layer during creation (without task_layer_constraint_id).
 */
export interface CreateTaskLayerConstraint {
  min?: number | null; // Optional minimum value (for some constraints)
  max?: number | null; // Optional maximum value (for some constraints)
  type: 'percent' | 'unit'; // Type of the constraint, either 'percent' or 'unit'
}

/**
 * Interface representing a layer for a task during creation (without task_layer_id).
 */
export interface CreateTaskLayer {
  layer_name: string; // Name of the layer
  description: string | null; // Description of the layer
  mode: 'flexible' | 'locked-in' | 'locked-out'; // Mode of the layer
  importance?: number | null; // Optional importance (required when mode is flexible)
  threshold?: number | null; // Optional threshold (required when mode is locked-in or locked-out)
  constraints: CreateTaskLayerConstraint[]; // Constraints for this layer
}

export interface ITask {
  task_id: string;
  name: string;
  description: string | null;
  layers: TaskLayer[];
  resampling: RESAMPLING;
  variant: OPTIMIZATION_VARIANT;
}

/**
 * Request interface for creating a task.
 */
export interface CreateTaskRequest {
  name: string; // Name of the task
  description: string; // Description of the task
  layers: CreateTaskLayer[]; // Layers for the task (each layer can have constraints)
  resolution: number; // Resolution for the task
  resampling: RESAMPLING; // Resampling method
  budget?: {
    name: string;
    path: string;
    constraints: CreateTaskLayerConstraint[]; // Constraints for the budget layer
  }; // Optional budget layer
  variant: OPTIMIZATION_VARIANT; // Optimization variant
}

/**
 * Response interface for a task (including layers and constraints).
 */

export interface GetTaskResponse {
  task_id: string; // UUID of the task
  name: string; // Name of the task
  description: string | null; // Description of the task
  tileset_uri?: string | null;
  status: TaskStatusValue;
  status_message?: string | null;
  prefect_flow_run_id?: string | null;
  prefect_deployment_id?: string | null;
  record_effective_date?: string; // ISO string of record effective date
  record_end_date?: string | null; // ISO string of record end date or null
  resolution?: number;
  resampling?: RESAMPLING;
  variant?: OPTIMIZATION_VARIANT;
  layers: TaskLayer[]; // List of layers with constraints
  budget?: TaskLayer | null;
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

/**
 * Interface for the task layer (with task_layer_id and task_id as primary keys).
 */
export interface TaskLayer {
  task_layer_id: string; // UUID of the layer
  task_id: string; // UUID of the task it belongs to
  layer_name: string; // Name of the layer
  description: string | null; // Description of the layer
  mode: 'flexible' | 'locked-in' | 'locked-out';
  importance?: number | null;
  threshold?: number | null;
  constraints: TaskLayerConstraint[]; // List of constraints for this layer
}

/**
 * Interface for the task layer constraint (with task_layer_constraint_id and task_layer_id as primary keys).
 */
export interface TaskLayerConstraint {
  task_layer_constraint_id: string; // UUID of the constraint
  task_layer_id: string; // UUID of the layer it belongs to
  min?: number | null; // Optional minimum value (for some constraints)
  max?: number | null; // Optional maximum value (for some constraints)
  type: 'percent' | 'unit'; // Type of the constraint, either 'percent' or 'unit'
}
