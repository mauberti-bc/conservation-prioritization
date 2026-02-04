/**
 * Interface for a constraint within a task layer.
 */
export interface CreateTaskLayerConstraintRequest {
  type: 'percent' | 'unit';
  min?: number | null;
  max?: number | null;
}

/**
 * Interface for a layer within a task.
 */
export interface CreateTaskLayerRequest {
  layer_name: string;
  description: string | null;
  mode: 'flexible' | 'locked-in' | 'locked-out';
  importance?: number | null;
  threshold?: number | null;
  constraints: CreateTaskLayerConstraintRequest[];
}

/**
 * Interface for creating a task.
 */
export interface CreateTaskRequest {
  name: string;
  description: string;
  layers: CreateTaskLayerRequest[];
  resolution?: number;
  resampling?: 'mode' | 'min' | 'max';
  variant?: 'strict' | 'approximate';
  budget?: CreateTaskLayerRequest;
}
