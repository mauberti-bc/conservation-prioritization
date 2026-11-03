import { TaskTileStatus } from '../../../../models/task-tile';

export interface UpdateTaskTileStatusBody {
  status: TaskTileStatus;
  pmtiles_uri?: string | null;
  content_type?: string | null;
  error_code?: string | null;
  error_message?: string | null;
}
