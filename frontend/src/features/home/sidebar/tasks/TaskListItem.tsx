import {
  mdiAccountPlus,
  mdiAlertCircleOutline,
  mdiCheck,
  mdiDelete,
  mdiFolderPlusOutline,
  mdiPencil,
  mdiPlay,
  mdiProgressClock,
} from '@mdi/js';
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
  onInvite?: (task: GetTaskResponse) => void;
  showActions: boolean;
}

export const TaskListItem = ({
  task,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onAddToProject,
  onInvite,
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
      label: 'Add to Project',
      icon: mdiFolderPlusOutline,
      onClick: () => {
        onAddToProject(task);
      },
    },
    {
      label: 'Invite',
      icon: mdiAccountPlus,
      onClick: () => {
        onInvite?.(task);
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

  const handleStopTask = async () => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Stop task?',
      dialogText: `Stop "${task.name}"?`,
      onYes: async () => {
        try {
          dialogContext.setYesNoDialog({ open: false });
          await conservationApi.task.updateTaskStatus(task.task_id, { status: TASK_STATUS.DRAFT });
          await refreshTasks();
        } catch (error) {
          console.error(error);
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: 'Failed to stop task.',
          });
        }
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
    });
  };

  const handleStartDraftTask = async () => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Submit task?',
      dialogText: `Submit "${task.name}" to Prefect?`,
      onYes: async () => {
        try {
          dialogContext.setYesNoDialog({ open: false });
          await conservationApi.task.updateTaskStatus(task.task_id, { status: TASK_STATUS.PENDING });
          await refreshTasks();
        } catch (error) {
          console.error(error);
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: 'Failed to submit task.',
          });
        }
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
    });
  };

  const renderStatusIndicator = () => {
    if (task.status === TASK_STATUS.DRAFT) {
      return (
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            void handleStartDraftTask();
          }}>
          <Icon path={mdiPlay} size={1} />
        </IconButton>
      );
    }

    if (task.status === TASK_STATUS.PENDING) {
      return (
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            void handleStopTask();
          }}>
          <Icon path={mdiProgressClock} size={1} />
        </IconButton>
      );
    }

    if (task.status === TASK_STATUS.SUBMITTED) {
      return <CircularProgress size={20} thickness={5} />;
    }

    if (task.status === TASK_STATUS.RUNNING) {
      return <CircularProgress size={20} thickness={5} />;
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

    if (task.status === TASK_STATUS.COMPLETED) {
      return (
        <IconButton
          color="success"
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            void handleRetryTask();
          }}>
          <Icon path={mdiCheck} size={1} />
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
          setHoveredTilesetUri(null);
          onSelectTask(task);
        }}>
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
              <Typography fontWeight={700} noWrap>
                {task.name}
              </Typography>
              {task.projects?.length ? (
                <Box display="flex" alignItems="center" gap={0.5}>
                  {task.projects.map((project) => (
                    <Box
                      key={project.project_id}
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: project.colour,
                      }}
                    />
                  ))}
                </Box>
              ) : null}
            </Box>
          }
          secondary={task.description ?? undefined}
        />
        <Box display="flex" alignItems="center" justifyContent="center" ml="auto" mx={3} sx={{ minWidth: 32 }}>
          {renderStatusIndicator()}
        </Box>
      </InteractiveListItemButton>
    </ListItem>
  );
};
