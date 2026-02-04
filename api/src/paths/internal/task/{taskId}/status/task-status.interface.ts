import { TaskStatus } from '../../../../../models/task';

export interface UpdateTaskStatusBody {
  status: TaskStatus;
  message?: string | null;
  output_uri?: string | null;
}
