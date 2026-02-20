import { mdiArrowLeft, mdiDockRight, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton } from '@mui/material';
import Box from '@mui/material/Box';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { TASK_VIEW_PREVIEW_COLLAPSED_WIDTH, TASK_VIEW_PREVIEW_WIDTH } from './task-view-sidebar.constants';
import { TaskViewSidebarPreviewList } from './TaskViewSidebarPreviewList';

interface TaskViewSidebarPreviewRailProps {
  isPreviewOpen: boolean;
  taskId: string;
  previewTasks: GetTaskResponse[];
  onTogglePreview: () => void;
  onBackToTasks: () => void;
  onOpenCreateTask: () => void;
  onSelectTask: (task: GetTaskResponse) => void;
}

export const TaskViewSidebarPreviewRail = ({
  isPreviewOpen,
  taskId,
  previewTasks,
  onTogglePreview,
  onBackToTasks,
  onOpenCreateTask,
  onSelectTask,
}: TaskViewSidebarPreviewRailProps) => {
  if (!isPreviewOpen) {
    return (
      <Box
        sx={{
          width: `${TASK_VIEW_PREVIEW_COLLAPSED_WIDTH}px`,
          minWidth: `${TASK_VIEW_PREVIEW_COLLAPSED_WIDTH}px`,
          boxSizing: 'border-box',
          p: 2,
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          minHeight: 0,
        }}>
        <IconButton aria-label="Expand task list sidebar" size="small" onClick={onTogglePreview}>
          <Icon path={mdiDockRight} size={1} />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: `${TASK_VIEW_PREVIEW_WIDTH}px`,
        minWidth: `${TASK_VIEW_PREVIEW_WIDTH}px`,
        boxSizing: 'border-box',
        p: 2,
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={1}>
        <IconButton aria-label="Back to tasks" size="small" onClick={onBackToTasks}>
          <Icon path={mdiArrowLeft} size={1} />
        </IconButton>
        <Box display="flex" alignItems="center" gap={0.5}>
          <IconButton aria-label="Create task" size="small" onClick={onOpenCreateTask}>
            <Icon path={mdiPlus} size={1} />
          </IconButton>
          <IconButton aria-label="Collapse task list sidebar" size="small" onClick={onTogglePreview}>
            <Icon path={mdiDockRight} size={1} />
          </IconButton>
        </Box>
      </Box>

      <TaskViewSidebarPreviewList previewTasks={previewTasks} taskId={taskId} onSelectTask={onSelectTask} />
    </Box>
  );
};
