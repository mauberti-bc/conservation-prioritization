import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SidebarView } from 'context/sidebarUIContext';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { TaskDetailsPanel } from '../sidebar/tasks/TaskDetailsPanel';
import { CreateTaskPage } from '../task/create/CreateTaskPage';

interface MainPanelProps {
  activeView: SidebarView;
  onTaskCreated?: (task: GetTaskResponse) => void;
}

/**
 * Renders main panel content based on the active sidebar view.
 *
 * @param {MainPanelProps} props
 * @returns {JSX.Element}
 */
export const MainPanel = ({ activeView, onTaskCreated }: MainPanelProps) => {
  if (activeView === 'new') {
    return <CreateTaskPage onTaskCreated={onTaskCreated} />;
  }

  if (activeView === 'tasks') {
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
