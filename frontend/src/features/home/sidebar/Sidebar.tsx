import Box from '@mui/material/Box';
import { TaskSubmitPanel } from '../task/create/TaskSubmitPanel';

/**
 * Task sidebar panel shown when a task is selected.
 */
export const Sidebar = () => {
  return (
    <Box
      sx={{
        boxSizing: 'border-box',
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <TaskSubmitPanel />
      </Box>
    </Box>
  );
};
