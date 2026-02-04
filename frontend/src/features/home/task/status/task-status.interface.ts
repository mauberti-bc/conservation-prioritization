import { TaskStatusValue, TileStatusValue } from 'constants/status';

export interface TaskStatusMessage {
  task_id: string;
  status: TaskStatusValue;
  updated_at?: string;
  tile?: {
    status: TileStatusValue;
    pmtiles_uri?: string | null;
  } | null;
}
