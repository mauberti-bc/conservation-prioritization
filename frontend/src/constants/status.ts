export const TASK_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  IN_PROGRESS: 'in_progress',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ABORTED: 'aborted',
  INFEASIBLE: 'infeasible',
  FAILED: 'failed',
  FAILED_TO_SUBMIT: 'failed_to_submit',
} as const;

export type TaskStatusValue = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

/**
 * Task outcomes that no longer represent active processing.
 */
export const TERMINAL_STATUSES: readonly TaskStatusValue[] = [
  TASK_STATUS.COMPLETED,
  TASK_STATUS.ABORTED,
  TASK_STATUS.INFEASIBLE,
  TASK_STATUS.FAILED,
  TASK_STATUS.FAILED_TO_SUBMIT,
];

export const TILE_STATUS = {
  DRAFT: 'draft',
  STARTED: 'started',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type TileStatusValue = (typeof TILE_STATUS)[keyof typeof TILE_STATUS];
