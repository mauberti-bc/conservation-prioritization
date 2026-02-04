import { mdiAlertCircleOutline, mdiDelete, mdiEyeOutline, mdiFolderPlusOutline, mdiPencil } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Chip, CircularProgress, IconButton, ListItem, ListItemText, Typography } from '@mui/material';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { InteractiveListItemButton } from 'components/list/InteractiveListItemButton';
import { TASK_STATUS } from 'constants/status';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useTaskContext } from 'hooks/useContext';

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
  const dialogContext = useDialogContext();
  const conservationApi = useConservationApi();
  const { taskId, refreshTasks, setHoveredTilesetUri } = useTaskContext();

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

  const handleRetryTask = async () => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Retry task?',
      dialogText: `Would you like to retry "${task.name}"?`,
      onYes: async () => {
        try {
          dialogContext.setYesNoDialog({ open: false });
          await conservationApi.task.updateTaskStatus(task.task_id, { status: TASK_STATUS.PENDING });
          await refreshTasks();
        } catch (error) {
          console.error(error);
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: 'Failed to retry task.',
          });
        }
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
    });
  };

  const renderStatusIndicator = () => {
    if (task.status === TASK_STATUS.PENDING) {
      return <CircularProgress size={16} thickness={7} />;
    }

    if (task.status === TASK_STATUS.FAILED || task.status === TASK_STATUS.FAILED_TO_SUBMIT) {
      return (
        <IconButton
          color="error"
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            void handleRetryTask();
          }}>
          <Icon path={mdiAlertCircleOutline} size={1} />
        </IconButton>
      );
    }

    return <Chip size="small" label={task.status} sx={{ px: 1, width: 'fit-content' }} />;
  };

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
        onMouseEnter={() => {
          if (task.tileset_uri) {
            setHoveredTilesetUri(task.tileset_uri);
          }
        }}
        onMouseLeave={() => {
          setHoveredTilesetUri(null);
        }}
        onClick={() => {
          onSelectTask(task);
        }}>
        <ListItemText
          primary={
            <Typography fontWeight={700} noWrap>
              {task.name}
            </Typography>
          }
          secondary={task.description ?? undefined}
        />
        <Box display="flex" alignItems="center" ml="auto" mx={3}>
          {renderStatusIndicator()}
        </Box>
      </InteractiveListItemButton>
    </ListItem>
  );
};
