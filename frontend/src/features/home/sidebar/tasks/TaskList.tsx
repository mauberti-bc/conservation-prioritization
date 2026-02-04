import { Box, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { HomeQueryParams, QUERY_PARAM } from 'constants/query-params';
import { useSearchParams } from 'hooks/useSearchParams';

interface TaskListProps {
  tasks: GetTaskResponse[];
  isLoading: boolean;
  selectedTaskId: string | null;
  onSelectTask: (task: GetTaskResponse) => void;
}

export const TaskList = ({ tasks, isLoading, selectedTaskId, onSelectTask }: TaskListProps) => {
  const { searchParams, setSearchParams } = useSearchParams<HomeQueryParams>();

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
      <LoadingGuard
        isLoading={isLoading}
        isLoadingFallback={
          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
            Loading tasks...
          </Typography>
        }
        hasNoData={tasks.length === 0}
        hasNoDataFallback={
          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
            No tasks available
          </Typography>
        }>
        <List dense>
          {tasks.map((task) => (
            <ListItemButton
              key={task.task_id}
              selected={task.task_id === selectedTaskId}
              onClick={() => {
                searchParams.set(QUERY_PARAM.TASK_ID, task.task_id);
                setSearchParams(searchParams);
                onSelectTask(task);
              }}>
              <ListItemText primary={task.name} secondary={task.status} />
            </ListItemButton>
          ))}
        </List>
      </LoadingGuard>
    </Box>
  );
};
