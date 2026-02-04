import { TaskStatus } from '../../../../../models/task';

export interface UpdateTaskStatusBody {
  status: TaskStatus;
  message?: string | null;
}
