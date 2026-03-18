import { TaskStatus } from '../../../models/task';
import { CreateTaskLayerRequest } from '../../../models/task-orchestrator';

export interface UpdateTaskBody {
  name?: string;
  description?: string | null;
  resolution?: number | null;
  resampling?: 'mode' | 'min' | 'max' | null;
  variant?: 'strict' | 'approximate' | null;
  status?: TaskStatus;
  layers?: CreateTaskLayerRequest[];
  budget?: CreateTaskLayerRequest;
}
