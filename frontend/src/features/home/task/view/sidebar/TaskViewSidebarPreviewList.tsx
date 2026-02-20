import { List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';

interface TaskViewSidebarPreviewListProps {
  previewTasks: GetTaskResponse[];
  taskId: string;
  onSelectTask: (task: GetTaskResponse) => void;
}

export const TaskViewSidebarPreviewList = ({ previewTasks, taskId, onSelectTask }: TaskViewSidebarPreviewListProps) => {
  return (
    <List dense sx={{ pt: 0, overflowY: 'auto', flex: 1 }}>
      {previewTasks.map((task) => {
        const isSelected = task.task_id === taskId;

        return (
          <ListItem key={task.task_id} disablePadding>
            <ListItemButton
              sx={{ py: 0.75 }}
              selected={isSelected}
              onClick={() => {
                onSelectTask(task);
              }}>
              <ListItemText
                primary={
                  <Typography variant="body2" noWrap sx={{ color: isSelected ? 'inherit' : grey[600] }}>
                    {task.name}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
};
