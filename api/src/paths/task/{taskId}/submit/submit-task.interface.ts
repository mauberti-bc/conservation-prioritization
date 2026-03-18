import { CreateTaskGeometryRequest, CreateTaskLayerRequest } from '../../../../models/task-orchestrator';

/**
 * Request body for submitting an existing draft task.
 */
export interface SubmitTaskBody {
  layers?: CreateTaskLayerRequest[];
  budget?: CreateTaskLayerRequest | null;
  geometry?: CreateTaskGeometryRequest[];
  resolution?: number | null;
  resampling?: 'mode' | 'min' | 'max' | null;
  variant?: 'strict' | 'approximate' | null;
  target_area?: number;
  is_percentage?: boolean;
}
