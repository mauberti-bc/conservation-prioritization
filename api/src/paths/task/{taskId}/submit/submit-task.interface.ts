import { CreateTaskLayerRequest } from '../../../../models/task-orchestrator';

/**
 * Request body for submitting an existing draft task.
 */
export interface SubmitTaskBody {
  layers: CreateTaskLayerRequest[];
  budget?: CreateTaskLayerRequest;
}
