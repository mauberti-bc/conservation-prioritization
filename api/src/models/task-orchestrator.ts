/**
 * Interface for a constraint within a task layer.
 */
export interface CreateTaskLayerConstraint {
  task_layer_id: string;
  constraint_name: string;
  constraint_value: string;
}

/**
 * Interface for a layer within a task.
 */
export interface CreateTaskLayer {
  task_id: string;
  layer_name: string;
  description: string;
  constraints: CreateTaskLayerConstraint[];
}

/**
 * Interface for creating a task.
 */
export interface CreateTaskRequest {
  name: string;
  description: string;
  layers: CreateTaskLayer[];
}
