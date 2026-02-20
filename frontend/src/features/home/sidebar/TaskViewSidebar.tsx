import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { TaskViewPanel } from '../task/view/TaskViewPanel';

/**
 * Sidebar shown while viewing an existing task.
 */
export const TaskViewSidebar = () => {
  return (
    <Box
      component={Paper}
      elevation={1}
      sx={{
        boxSizing: 'border-box',
        flex: 1,
        minWidth: 0,
        borderRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <TaskViewPanel />
      </Box>
    </Box>
  );
};
