import type { TaskStatus } from '../../../../models/task';

export interface UpdateTaskStatusParams {
  taskId: string;
}

export interface UpdateTaskStatusBody {
  status: TaskStatus;
  message?: string | null;
}
