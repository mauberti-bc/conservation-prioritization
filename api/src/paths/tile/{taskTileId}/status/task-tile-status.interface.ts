import type { TaskTileStatus } from '../../../../models/task-tile';

export interface UpdateTaskTileStatusParams {
  taskTileId: string;
}

export interface UpdateTaskTileStatusBody {
  status: TaskTileStatus;
  uri?: string | null;
  content_type?: string | null;
  error_code?: string | null;
  error_message?: string | null;
}
