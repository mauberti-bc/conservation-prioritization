export interface TaskStatusMessage {
  task_id: string;
  status: string;
  updated_at?: string;
  tile?: {
    status: string;
    uri?: string | null;
  } | null;
}
