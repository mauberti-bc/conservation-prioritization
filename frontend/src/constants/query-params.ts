export const QUERY_PARAM = {
  // VIEW: controls HomePage active sidebar view (new/tasks/projects/layers)
  VIEW: 'v',
} as const;

export type QueryParamKey = (typeof QUERY_PARAM)[keyof typeof QUERY_PARAM];

export type HomeQueryParams = {
  [QUERY_PARAM.VIEW]?: 'new' | 'tasks' | 'projects' | 'layers';
};
