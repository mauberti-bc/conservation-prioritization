export const QUERY_PARAM = {
  // VIEW: controls HomePage active sidebar view (tasks/projects/layers)
  VIEW: 'v',
  // TASK_ID: focused task id for the home sidebar
  TASK_ID: 'taskId',
} as const;

export type QueryParamKey = (typeof QUERY_PARAM)[keyof typeof QUERY_PARAM];

export type HomeQueryParams = {
  [QUERY_PARAM.VIEW]?: 'tasks' | 'projects' | 'layers';
  [QUERY_PARAM.TASK_ID]?: string;
};
