import { TaskStatus, TaskType } from '../../../models/task';

export interface UpdateTaskBody {
  type?: TaskType;
  name?: string;
  description?: string | null;
  resolution?: number | null;
  resampling?: 'mode' | 'min' | 'max' | null;
  status?: TaskStatus;
}
