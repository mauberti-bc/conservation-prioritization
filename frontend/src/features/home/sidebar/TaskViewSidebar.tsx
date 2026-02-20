import { mdiArrowLeft, mdiDockRight } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useTaskContext } from 'hooks/useContext';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { TaskViewPanel } from '../task/view/TaskViewPanel';

export const TASK_VIEW_PREVIEW_WIDTH = 184;
export const TASK_VIEW_PREVIEW_COLLAPSED_WIDTH = 44;
export const TASK_VIEW_DETAIL_WIDTH = 500;

export const getTaskViewSidebarWidth = (isPreviewOpen: boolean) => {
  const previewWidth = isPreviewOpen ? TASK_VIEW_PREVIEW_WIDTH : TASK_VIEW_PREVIEW_COLLAPSED_WIDTH;

  return TASK_VIEW_DETAIL_WIDTH + previewWidth;
};

interface TaskViewSidebarProps {
  isPreviewOpen: boolean;
  onTogglePreview: () => void;
}

interface PreviewRailProps {
  isPreviewOpen: boolean;
  taskId: string;
  previewTasks: GetTaskResponse[];
  onTogglePreview: () => void;
  onBackToTasks: () => void;
  onSelectTask: (task: GetTaskResponse) => void;
}

const PreviewRail = ({
  isPreviewOpen,
  taskId,
  previewTasks,
  onTogglePreview,
  onBackToTasks,
  onSelectTask,
}: PreviewRailProps) => {
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
        p: 2.5,
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
        <IconButton aria-label="Back to tasks" size="small" onClick={onBackToTasks}>
          <Icon path={mdiArrowLeft} size={0.85} />
        </IconButton>
        <IconButton aria-label="Collapse task list sidebar" size="small" onClick={onTogglePreview}>
          <Icon path={mdiDockRight} size={1} />
        </IconButton>
      </Box>

      <List dense sx={{ pt: 0, overflowY: 'auto', flex: 1 }}>
        {previewTasks.map((task) => {
          return (
            <ListItem key={task.task_id} disablePadding>
              <ListItemButton
                selected={task.task_id === taskId}
                onClick={() => {
                  onSelectTask(task);
                }}>
                <ListItemText
                  primary={
                    <Typography variant="body2" noWrap>
                      {task.name}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

/**
 * Sidebar shown while viewing an existing task.
 */
export const TaskViewSidebar = ({ isPreviewOpen, onTogglePreview }: TaskViewSidebarProps) => {
  const navigate = useNavigate();
  const { taskId, tasksDataLoader, setFocusedTask } = useTaskContext();
  const defaultPagination = useMemo<ApiPaginationRequestOptions>(() => {
    return {
      page: 1,
      limit: 25,
      sort: 'created_at',
      order: 'desc',
    };
  }, []);

  useEffect(() => {
    if (!tasksDataLoader.hasLoaded) {
      void tasksDataLoader.load(defaultPagination);
    }
  }, [defaultPagination, tasksDataLoader]);

  const previewTasks = tasksDataLoader.data?.tasks ?? [];
  const totalWidth = getTaskViewSidebarWidth(isPreviewOpen);

  return (
    <Box
      component={Paper}
      elevation={1}
      sx={{
        boxSizing: 'border-box',
        width: `${totalWidth}px`,
        minWidth: `${totalWidth}px`,
        maxWidth: `${totalWidth}px`,
        height: '100%',
        minHeight: 0,
        borderRadius: 0,
        overflow: 'hidden',
      }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          minHeight: 0,
        }}>
        <PreviewRail
          isPreviewOpen={isPreviewOpen}
          taskId={taskId}
          previewTasks={previewTasks}
          onTogglePreview={onTogglePreview}
          onBackToTasks={() => {
            navigate('/');
          }}
          onSelectTask={(task) => {
            setFocusedTask(task);
          }}
        />

        <Box
          sx={{
            width: `${TASK_VIEW_DETAIL_WIDTH}px`,
            minHeight: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
            p: 0,
          }}>
          <TaskViewPanel />
        </Box>
      </Box>
    </Box>
  );
};
