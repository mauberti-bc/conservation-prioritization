import { TASK_STATUS, TaskStatusValue } from 'constants/status';
import { TaskViewStatusColor } from './colour.interface';

/**
 * Maps a task status to its task-view status color.
 *
 * @param {TaskStatusValue} status The task's current execution status.
 * @returns {TaskViewStatusColor} The informational, success, or default color.
 */
export const getTaskViewStatusColor = (status: TaskStatusValue): TaskViewStatusColor => {
  switch (status) {
    case TASK_STATUS.RUNNING:
    case TASK_STATUS.IN_PROGRESS: {
      return 'info';
    }
    case TASK_STATUS.COMPLETED: {
      return 'success';
    }
    case TASK_STATUS.FAILED: {
      return 'error';
    }
    default: {
      return 'default';
    }
  }
};

/**
 * Converts a user-entered hex body (with or without leading #) to canonical API format.
 *
 * @param {string | null | undefined} value Value to normalize or inspect.
 * @return {string | undefined} A #RRGGBB value or undefined when empty.
 */
export const toApiHexColour = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const hexBody = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  return `#${hexBody.toUpperCase()}`;
};

/**
 * Converts API hex values to the form field body value (without leading #).
 *
 * @param {string | null | undefined} value Value to normalize or inspect.
 * @returns {string} To hex body.
 */
export const toHexBody = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  return value.startsWith('#') ? value.slice(1).toUpperCase() : value.toUpperCase();
};

/**
 * Generates a random hex colour in #RRGGBB format.
 *
 * @returns {string} Random hex.
 */
export const getRandomHex = (): string => {
  const value = Math.floor(Math.random() * 0xffffff);
  return `#${value.toString(16).padStart(6, '0').toUpperCase()}`;
};

/**
 * Generates a random hex colour body in RRGGBB format.
 *
 * @returns {string} Random hex body.
 */
export const getRandomHexBody = (): string => {
  return getRandomHex().slice(1);
};
