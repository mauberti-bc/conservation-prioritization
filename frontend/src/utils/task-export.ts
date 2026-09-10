import { GetTaskResponse, TaskExportFormat, TaskExportResponse } from 'hooks/interfaces/useTaskApi.interface';

export type TaskExportAction = 'create' | 'download' | 'preparing' | 'unavailable';

/**
 * Returns the newest export for a task's latest run.
 *
 * @param {GetTaskResponse} task Task response with optional latest run exports.
 * @returns {TaskExportResponse | null} The newest export, if one exists.
 */
export const getLatestTaskExport = (task: GetTaskResponse, format?: TaskExportFormat): TaskExportResponse | null => {
  const exports = task.latest_run?.exports ?? [];
  if (!format) {
    return exports[0] ?? null;
  }

  return exports.find((taskExport) => taskExport.format === format) ?? null;
};

/**
 * Returns whether a task's newest export is ready to download.
 *
 * @param {GetTaskResponse} task Task response with optional latest run exports.
 * @returns {boolean} True when the newest export is ready.
 */
export const isTaskLatestExportReady = (task: GetTaskResponse): boolean => {
  return getLatestTaskExport(task)?.status === 'ready';
};

/**
 * Resolves the download-button action for a task.
 *
 * @param {GetTaskResponse} task Task response with optional latest run exports.
 * @returns {TaskExportAction} The action the UI should take when the export button is clicked.
 */
export const getTaskExportAction = (task: GetTaskResponse, format?: TaskExportFormat): TaskExportAction => {
  if (!task.latest_run || task.latest_run.status !== 'completed') {
    return 'unavailable';
  }

  const latestExport = getLatestTaskExport(task, format);
  if (!latestExport || latestExport.status === 'failed') {
    return 'create';
  }

  if (latestExport.status === 'queued' || latestExport.status === 'running') {
    return 'preparing';
  }

  return 'download';
};

/**
 * Triggers a browser download for one presigned export URL.
 *
 * @param {string} url Presigned object URL.
 * @param {string} filename Suggested browser download filename.
 * @returns {void}
 */
export const triggerBrowserDownload = (url: string, filename: string): void => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};
