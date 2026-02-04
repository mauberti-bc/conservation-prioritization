export enum OPTIMIZATION_VARIANT {
  STRICT = 'strict',
  APPROXIMATE = 'approximate',
}

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
  name: string; // Name of the layer
  description: string | null; // Description of the layer
  mode: 'flexible' | 'locked-in' | 'locked-out'; // Mode of the layer
  importance?: number | null; // Optional importance (required when mode is flexible)
  threshold?: number | null; // Optional threshold (required when mode is locked-in or locked-out)
  constraints: CreateTaskLayerConstraint[]; // Constraints for this layer
}

/**
 * Request interface for creating a task.
 */
export interface CreateTaskRequest {
  name: string; // Name of the task
  description: string; // Description of the task
  layers: CreateTaskLayer[]; // Layers for the task (each layer can have constraints)
  resolution: number; // Resolution for the task
  resampling: 'mode' | 'min' | 'max'; // Resampling method
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
  description: string; // Description of the task
  record_effective_date: string; // ISO string of record effective date
  record_end_date: string | null; // ISO string of record end date or null
  layers: TaskLayer[]; // List of layers with constraints
}

/**
 * Interface for the task layer (with task_layer_id and task_id as primary keys).
 */
export interface TaskLayer {
  task_layer_id: string; // UUID of the layer
  task_id: string; // UUID of the task it belongs to
  layer_name: string; // Name of the layer
  description: string; // Description of the layer
  constraints: TaskLayerConstraint[]; // List of constraints for this layer
}

/**
 * Interface for the task layer constraint (with task_layer_constraint_id and task_layer_id as primary keys).
 */
export interface TaskLayerConstraint {
  task_layer_constraint_id: string; // UUID of the constraint
  task_layer_id: string; // UUID of the layer it belongs to
  constraint_name: string; // Name of the constraint
  constraint_value: string; // Value of the constraint
  min?: number | null; // Optional minimum value (for some constraints)
  max?: number | null; // Optional maximum value (for some constraints)
  type: 'percent' | 'unit'; // Type of the constraint, either 'percent' or 'unit'
}
