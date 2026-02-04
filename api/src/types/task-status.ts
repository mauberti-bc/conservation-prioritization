import type { TaskStatusValue, TileStatusValue } from './status';

export interface TaskStatusMessage {
  task_id: string;
  status: TaskStatusValue;
  updated_at?: string;
  tile?: {
    status: TileStatusValue;
    uri?: string | null;
  } | null;
}
