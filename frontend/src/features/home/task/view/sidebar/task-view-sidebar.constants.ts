export const TASK_VIEW_PREVIEW_WIDTH = 200;
export const TASK_VIEW_PREVIEW_COLLAPSED_WIDTH = 44;
export const TASK_VIEW_DETAIL_WIDTH = 500;

export const getTaskViewSidebarWidth = (isPreviewOpen: boolean) => {
  const previewWidth = isPreviewOpen ? TASK_VIEW_PREVIEW_WIDTH : TASK_VIEW_PREVIEW_COLLAPSED_WIDTH;

  return TASK_VIEW_DETAIL_WIDTH + previewWidth;
};
