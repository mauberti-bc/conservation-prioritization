import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { SidebarView } from 'context/sidebarUIContext';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { TaskDetailsPanel } from '../sidebar/tasks/TaskDetailsPanel';
import { CreateTask } from '../task/create/CreateTask';
import { EditTask } from '../task/create/EditTask';

interface MainPanelProps {
  activeView: SidebarView;
  onTaskCreated?: (task: GetTaskResponse) => void;
  onClose?: () => void;
  taskMode?: 'view' | 'edit';
  taskId?: string | null;
}

/**
 * Renders main panel content based on the active sidebar view.
 *
 * @param {MainPanelProps} props
 * @returns {JSX.Element}
 */
export const MainPanel = ({ activeView, onTaskCreated, onClose, taskMode = 'view', taskId }: MainPanelProps) => {
  return (
    <Box sx={{ height: '100%', position: 'relative' }}>
      {onClose && (
        <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
          <IconButton aria-label="Close panel" onClick={onClose}>
            <Icon path={mdiClose} size={1} />
          </IconButton>
        </Box>
      )}
      <Box sx={{ height: '100%', overflow: 'hidden' }}>
        {renderMainPanel(activeView, onTaskCreated, taskMode, taskId)}
      </Box>
    </Box>
  );
};

const renderMainPanel = (
  activeView: SidebarView,
  onTaskCreated?: (task: GetTaskResponse) => void,
  taskMode: 'view' | 'edit' = 'view',
  taskId?: string | null
) => {
  if (activeView === 'new') {
    return <CreateTask onTaskCreated={onTaskCreated} />;
  }

  if (activeView === 'tasks') {
    if (taskMode === 'edit') {
      return <EditTask taskId={taskId ?? undefined} />;
    }

    return <TaskDetailsPanel />;
  }

  if (activeView === 'projects') {
    return (
      <Box p={3}>
        <Typography color="textSecondary">Select a project to view details.</Typography>
      </Box>
    );
  }

  if (activeView === 'layers') {
    return (
      <Box p={3}>
        <Typography color="textSecondary">Browse layers in the sidebar.</Typography>
      </Box>
    );
  }

  return null;
};
