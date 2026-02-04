import { Box, List, ListItem, ListItemText, Typography } from '@mui/material';
import { TASK_STATUS, TaskStatusValue } from 'constants/status';

interface Task {
  name: string;
  status: TaskStatusValue;
}
export const TaskList = () => {
  // For now, hardcoded empty array
  const tasks: Task[] = [{ name: 'Sample', status: TASK_STATUS.PENDING }]; // Replace with API call later

  return (
    <Box
      sx={{
        mt: 2,
        mx: 1,
        p: 1,
        borderRadius: 1,
        maxHeight: '300px',
        overflowY: 'auto',
      }}>
      <Typography sx={{ mb: 1, px: 1 }}>Tasks</Typography>
      {tasks.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
          No tasks available
        </Typography>
      ) : (
        <List dense>
          {tasks.map((task, index) => (
            <ListItem key={index}>
              <ListItemText primary={task.name} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};
