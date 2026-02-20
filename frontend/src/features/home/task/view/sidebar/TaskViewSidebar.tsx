import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import Paper from '@mui/material/Paper';
import { useTaskContext } from 'hooks/useContext';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { TaskViewPanel } from '../panel/TaskViewPanel';
import { TASK_VIEW_DETAIL_WIDTH } from './task-view-sidebar.constants';
import { TaskViewSidebarPreviewRail } from './TaskViewSidebarPreviewRail';

interface TaskViewSidebarProps {
  isPreviewOpen: boolean;
  onTogglePreview: () => void;
}

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

  return (
    <Box
      component={Paper}
      elevation={1}
      sx={{
        boxSizing: 'border-box',
        width: '100%',
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
        <Box bgcolor={grey[50]} borderRight={`1px solid ${grey[200]}`} sx={{ minHeight: 0 }}>
          <TaskViewSidebarPreviewRail
            isPreviewOpen={isPreviewOpen}
            taskId={taskId}
            previewTasks={previewTasks}
            onTogglePreview={onTogglePreview}
            onBackToTasks={() => {
              navigate('/');
            }}
            onOpenCreateTask={() => {
              navigate('/t/new');
            }}
            onSelectTask={(task) => {
              setFocusedTask(task);
            }}
          />
        </Box>

        <Box
          sx={{
            width: `${TASK_VIEW_DETAIL_WIDTH}px`,
            minHeight: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
            py: 2,
            px: 3,
          }}>
          <TaskViewPanel />
        </Box>
      </Box>
    </Box>
  );
};
