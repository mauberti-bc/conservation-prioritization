import { TaskStatusValue } from 'constants/status';

/**
 * Maps internal task status values to user-facing labels.
 *
 * @param {TaskStatusValue} status
 * @return {string}
 */
export const getTaskStatusLabel = (status: TaskStatusValue): string => {
  switch (status) {
    case 'draft': {
      return 'Not Submitted';
    }
    case 'failed_to_submit': {
      return 'Submission Failed';
    }
    case 'pending': {
      return 'Pending';
    }
    case 'submitted': {
      return 'Submitted';
    }
    case 'in_progress': {
      return 'In Progress';
    }
    case 'running': {
      return 'Running';
    }
    case 'completed': {
      return 'Completed';
    }
    case 'failed': {
      return 'Failed';
    }
    default: {
      return status;
    }
  }
};
