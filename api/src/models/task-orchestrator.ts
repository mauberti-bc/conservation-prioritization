/**
 * Interface for a constraint within a task layer.
 */
export interface CreateTaskLayerConstraintRequest {
  type: 'percent' | 'unit';
  min?: number | null;
  max?: number | null;
}

/**
 * Interface for a geometry item within a task request.
 */
export interface CreateTaskGeometryRequest {
  name?: string | null;
  description?: string | null;
  geojson: {
    geometry: unknown;
    [key: string]: unknown;
  };
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
  target_area?: number;
  is_percentage?: boolean;
  geometry?: CreateTaskGeometryRequest[];
  budget?: CreateTaskLayerRequest;
}

/**
 * Interface for creating a task draft.
 */
export interface CreateTaskDraftRequest {
  name: string;
  description?: string | null;
}

/**
 * Interface for submitting an existing draft task.
 */
export interface SubmitTaskRequest {
  layers?: CreateTaskLayerRequest[];
  budget?: CreateTaskLayerRequest | null;
  resolution?: number | null;
  resampling?: 'mode' | 'min' | 'max' | null;
  variant?: 'strict' | 'approximate' | null;
  target_area?: number;
  is_percentage?: boolean;
  geometry?: CreateTaskGeometryRequest[];
}
