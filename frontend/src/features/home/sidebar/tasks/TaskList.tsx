import { mdiDelete, mdiEyeOutline, mdiFolderPlusOutline, mdiPencil } from '@mdi/js';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { HomeQueryParams, QUERY_PARAM } from 'constants/query-params';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useProjectContext, useTaskContext } from 'hooks/useContext';
import { useSearchParams } from 'hooks/useSearchParams';
import { useEffect, useMemo, useState } from 'react';
import { ProjectList } from '../projects/ProjectList';

interface TaskListProps {
  tasks: GetTaskResponse[];
  isLoading: boolean;
  onSelectTask: (task: GetTaskResponse) => void;
  onEditTask?: (task: GetTaskResponse) => void;
  enableActions?: boolean;
  enableProjectDialog?: boolean;
}

interface TaskListItemProps {
  task: GetTaskResponse;
  onSelectTask: (task: GetTaskResponse) => void;
  onEditTask?: (task: GetTaskResponse) => void;
  onDeleteTask: (task: GetTaskResponse) => void;
  onAddToProject: (task: GetTaskResponse) => void;
  showActions: boolean;
}

const TaskListItem = ({
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
      <ListItemButton
        selected={task.task_id === taskId}
        onClick={() => {
          searchParams.set(QUERY_PARAM.TASK_ID, task.task_id);
          setSearchParams(searchParams);
          onSelectTask(task);
        }}>
        <ListItemText primary={task.name} secondary={task.status} />
      </ListItemButton>
    </ListItem>
  );
};

export const TaskList = ({
  tasks,
  isLoading,
  onSelectTask,
  onEditTask,
  enableActions = true,
  enableProjectDialog = true,
}: TaskListProps) => {
  const dialogContext = useDialogContext();
  const conservationApi = useConservationApi();
  const { refreshTasks } = useTaskContext();
  const { projectsDataLoader, refreshProjects } = useProjectContext();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [dialogSubmit, setDialogSubmit] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (projectDialogOpen) {
      void projectsDataLoader.load();
    }
  }, [projectDialogOpen, projectsDataLoader]);

  useEffect(() => {
    if (!projectDialogOpen) {
      setDialogSubmit(null);
      return;
    }

    setDialogSubmit(() => {
      return async () => {
        if (selectedProjectIds.length === 0 || selectedTaskIds.length === 0) {
          return;
        }

        await Promise.all(
          selectedProjectIds.map((projectId) => {
            return conservationApi.project.addTasksToProject(projectId, selectedTaskIds);
          })
        );

        await refreshProjects();
        await refreshTasks();
        setProjectDialogOpen(false);
      };
    });
  }, [projectDialogOpen, selectedProjectIds, selectedTaskIds, conservationApi, refreshProjects, refreshTasks]);

  const projectOptions = useMemo(() => {
    return projectsDataLoader.data ?? [];
  }, [projectsDataLoader.data]);

  const handleDeleteTask = (task: GetTaskResponse) => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete task?',
      dialogText: `Are you sure you want to delete "${task.name}"?`,
      onYes: async () => {
        dialogContext.setYesNoDialog({ open: false });
        await conservationApi.task.deleteTask(task.task_id);
        await refreshTasks();
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
    });
  };

  const handleAddToProject = (task: GetTaskResponse) => {
    if (!enableProjectDialog) {
      return;
    }
    setSelectedTaskIds([task.task_id]);
    setSelectedProjectIds([]);
    setProjectDialogOpen(true);
  };

  const handleConfirmAddToProject = async () => {
    await dialogSubmit?.();
  };

  return (
    <Box sx={{ overflowY: 'auto', maxHeight: '100%' }}>
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
            <TaskListItem
              key={task.task_id}
              task={task}
              onSelectTask={onSelectTask}
              onEditTask={onEditTask}
              onDeleteTask={handleDeleteTask}
              onAddToProject={handleAddToProject}
              showActions={enableActions}
            />
          ))}
        </List>
      </LoadingGuard>
      {enableProjectDialog && (
        <Dialog
          open={projectDialogOpen}
          onClose={() => {
            setProjectDialogOpen(false);
          }}
          fullWidth
          maxWidth="md">
          <DialogTitle>Add task to project</DialogTitle>
          <DialogContent dividers>
            <ProjectList
              projects={projectOptions}
              isLoading={projectsDataLoader.isLoading}
              onSelectTask={() => {
                return;
              }}
              selectable
              selectedProjectIds={selectedProjectIds}
              onToggleProject={(project) => {
                if (selectedProjectIds.includes(project.project_id)) {
                  setSelectedProjectIds(selectedProjectIds.filter((id) => id !== project.project_id));
                  return;
                }
                setSelectedProjectIds([...selectedProjectIds, project.project_id]);
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setProjectDialogOpen(false);
              }}>
              Cancel
            </Button>
            <Button variant="contained" disabled={selectedProjectIds.length === 0} onClick={handleConfirmAddToProject}>
              Add to Project
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};
