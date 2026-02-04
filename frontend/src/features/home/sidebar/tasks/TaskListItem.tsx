import { mdiDelete, mdiEyeOutline, mdiFolderPlusOutline, mdiPencil } from '@mdi/js';
import { Box, ListItem, ListItemText } from '@mui/material';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { InteractiveListItemButton } from 'components/list/InteractiveListItemButton';
import { HomeQueryParams, QUERY_PARAM } from 'constants/query-params';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useTaskContext } from 'hooks/useContext';
import { useSearchParams } from 'hooks/useSearchParams';

interface TaskListItemProps {
  task: GetTaskResponse;
  onSelectTask: (task: GetTaskResponse) => void;
  onEditTask?: (task: GetTaskResponse) => void;
  onDeleteTask: (task: GetTaskResponse) => void;
  onAddToProject: (task: GetTaskResponse) => void;
  showActions: boolean;
}

export const TaskListItem = ({
  task,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onAddToProject,
  showActions,
}: TaskListItemProps) => {
  const { searchParams, setSearchParams } = useSearchParams<HomeQueryParams>();
  const { taskId } = useTaskContext();

  const menuItems = [
    {
      label: 'Edit',
      icon: mdiPencil,
      onClick: () => {
        onEditTask?.(task);
      },
    },
    {
      label: 'View',
      icon: mdiEyeOutline,
      onClick: () => {
        onSelectTask(task);
      },
    },
    {
      label: 'Add to Project',
      icon: mdiFolderPlusOutline,
      onClick: () => {
        onAddToProject(task);
      },
    },
    {
      label: 'Delete',
      icon: mdiDelete,
      onClick: () => {
        onDeleteTask(task);
      },
    },
  ];

  return (
    <ListItem
      key={task.task_id}
      disablePadding
      secondaryAction={
        showActions ? (
          <Box
            onClick={(event) => {
              event.stopPropagation();
            }}>
            <IconMenuButton items={menuItems} />
          </Box>
        ) : undefined
      }>
      <InteractiveListItemButton
        selected={task.task_id === taskId}
        onClick={() => {
          searchParams.set(QUERY_PARAM.TASK_ID, task.task_id);
          setSearchParams(searchParams);
          onSelectTask(task);
        }}>
        <ListItemText primary={task.name} secondary={task.status} />
      </InteractiveListItemButton>
    </ListItem>
  );
};
