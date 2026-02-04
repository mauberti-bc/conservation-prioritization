import { TASK_STATUS, TILE_STATUS, TaskStatusValue, TileStatusValue } from '../types/status';

/**
 * Normalizes a task status string into a canonical value.
 *
 * @param {string | null | undefined} status
 * @return {*}  {TaskStatusValue | null}
 */
export const normalizeTaskStatus = (status?: string | null): TaskStatusValue | null => {
  if (!status) {
    return null;
  }

  const normalized = status.toLowerCase() as TaskStatusValue;

  if (Object.values(TASK_STATUS).includes(normalized)) {
    return normalized;
  }

  return null;
};

/**
 * Normalizes a tile status string into a canonical value.
 *
 * @param {string | null | undefined} status
 * @return {*}  {TileStatusValue | null}
 */
export const normalizeTileStatus = (status?: string | null): TileStatusValue | null => {
  if (!status) {
    return null;
  }

  const normalized = status.toLowerCase() as TileStatusValue;

  if (Object.values(TILE_STATUS).includes(normalized)) {
    return normalized;
  }

  return null;
};
