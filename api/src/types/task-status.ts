import { TaskStatusValue, TileStatusValue } from './status';

export interface TaskStatusMessage {
  task_id: string;
  status: TaskStatusValue;
  updated_at?: string;
  output_uri?: string | null;
  tile?: {
    status: TileStatusValue;
    pmtiles_uri?: string | null;
  } | null;
}
