import {
  mdiAccountPlusOutline,
  mdiAlertCircleOutline,
  mdiPencilOutline,
  mdiPlay,
  mdiProgressClock,
  mdiShareVariantOutline,
} from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Chip, CircularProgress, IconButton, ListItem, ListItemText, Typography } from '@mui/material';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { InteractiveListItemButton } from 'components/list/InteractiveListItemButton';
import { TASK_STATUS } from 'constants/status';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useTaskContext } from 'hooks/useContext';
import { useState } from 'react';
import { getTaskStatusLabel } from 'utils/task-status';

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
  const [isHovered, setIsHovered] = useState(false);
  void onDeleteTask;
  void onAddToProject;

  const menuItems = [
    {
      label: 'Share',
      icon: mdiShareVariantOutline,
      onClick: () => {
        onInvite?.(task);
      },
    },
    {
      label: 'Invite',
      icon: mdiAccountPlusOutline,
      onClick: () => {
        onInvite?.(task);
      },
    },
    {
      label: 'Edit',
      icon: mdiPencilOutline,
      onClick: () => {
        onEditTask?.(task);
      },
    },
  ];

  const handleRetryTask = async () => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Retry Task?',
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
      dialogTitle: 'Stop Task?',
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
      dialogTitle: 'Submit Task?',
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

    if (task.status === TASK_STATUS.IN_PROGRESS) {
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

    return <Chip size="small" label={getTaskStatusLabel(task.status)} sx={{ px: 1, width: 'fit-content' }} />;
  };

  return (
    <ListItem
      key={task.task_id}
      disablePadding
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      secondaryAction={
        showActions && isHovered ? (
          <Box
            onClick={(event) => {
              event.stopPropagation();
            }}
            sx={{
              '& .MuiIconButton-root': {
                width: 28,
                height: 28,
                p: 0.25,
              },
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
                        width: 12,
                        height: 12,
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
