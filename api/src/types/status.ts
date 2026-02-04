export const TASK_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  FAILED_TO_SUBMIT: 'failed_to_submit'
} as const;

export type TaskStatusValue = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const TILE_STATUS = {
  DRAFT: 'draft',
  STARTED: 'started',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export type TileStatusValue = (typeof TILE_STATUS)[keyof typeof TILE_STATUS];
