import { mdiAccountPlusOutline, mdiDeleteOutline, mdiPencilOutline, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { grey } from '@mui/material/colors';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { InteractiveListItemButton } from 'components/list/InteractiveListItemButton';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { TASK_STATUS } from 'constants/status';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useApplicationEventsContext, useDialogContext, useMapContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { getTaskStatusLabel } from 'utils/task-status';
import { FloatingSidebarContainer } from '../sidebar/FloatingSidebarContainer';
import { SIDEBAR_FLOAT_MARGIN_PX, SIDEBAR_FLOAT_WIDTH_PX } from '../sidebar/sidebar-layout.constants';
import { SidebarSection } from '../sidebar/SidebarSection';
import { CreateTask } from '../task/create/CreateTask';
import { TaskViewEditDialog } from '../task/view/dialog/TaskViewEditDialog';
import { TaskViewInviteDialog } from '../task/view/dialog/TaskViewInviteDialog';
import { TaskEditFormValues } from '../task/view/panel/task-view-panel.interface';
import { DrawControls } from './draw/DrawControls';
import { MapContainer } from './MapContainer';

const defaultPagination: ApiPaginationRequestOptions = {
  page: 1,
  limit: 25,
  sort: 'created_at',
  order: 'desc',
};

interface MapPageProps {
  mode?: 'tasks' | 'create';
}

/**
 * Full map workspace with one floating sidebar container.
 *
 * @param {MapPageProps} props
 * @returns {JSX.Element}
 */
export const MapPage = ({ mode = 'tasks' }: MapPageProps) => {
  const navigate = useNavigate();
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const { drawControlsRef } = useMapContext();
  const { connectionEpoch, markTaskSeen, taskRevisions, taskStatuses, unseenTaskIds } = useApplicationEventsContext();
  const tasksDataLoader = useDataLoader(conservationApi.task.getAllTasks);
  const refreshTasksRef = useRef(tasksDataLoader.refresh);
  const [searchTerm, setSearchTerm] = useState('');
  const [editTask, setEditTask] = useState<GetTaskResponse | null>(null);
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const [editTaskError, setEditTaskError] = useState<string | null>(null);
  const [inviteTask, setInviteTask] = useState<GetTaskResponse | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const isCreating = mode === 'create';
  refreshTasksRef.current = tasksDataLoader.refresh;

  useEffect(() => {
    void tasksDataLoader.load(defaultPagination);
  }, [tasksDataLoader]);

  useEffect(() => {
    if (!connectionEpoch) {
      return;
    }

    void refreshTasksRef.current({
      ...defaultPagination,
      search: searchTerm || undefined,
    });
  }, [connectionEpoch, searchTerm, taskRevisions]);

  const handleSearch = (term: string) => {
    const trimmedTerm = term.trim();
    setSearchTerm(trimmedTerm);
    void tasksDataLoader.refresh({
      ...defaultPagination,
      search: trimmedTerm || undefined,
    });
  };

  const refreshMapTasks = async () => {
    await tasksDataLoader.refresh({
      ...defaultPagination,
      search: searchTerm || undefined,
    });
  };

  const handleDeleteTask = (task: GetTaskResponse) => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete Task?',
      dialogText: `Are you sure you want to delete "${task.name}"?`,
      onYes: async () => {
        dialogContext.setYesNoDialog({ open: false });
        await conservationApi.task.deleteTask(task.task_id);
        await refreshMapTasks();
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
    });
  };

  const handleEditTask = (task: GetTaskResponse) => {
    setEditTaskError(null);
    setEditTask(task);
  };

  const handleEditTaskSave = async (values: TaskEditFormValues) => {
    if (!editTask) {
      return;
    }

    try {
      setEditTaskSaving(true);
      setEditTaskError(null);
      await conservationApi.task.updateTask(editTask.task_id, {
        name: values.name,
        description: values.description.trim() ? values.description : null,
      });
      await refreshMapTasks();
      setEditTask(null);
    } catch (error) {
      console.error('Failed to update task', error);
      setEditTaskError('Failed to update task. Please try again.');
    } finally {
      setEditTaskSaving(false);
    }
  };

  const handleShareTask = (task: GetTaskResponse) => {
    setInviteError(null);
    setInviteTask(task);
  };

  const handleInviteSubmit = async (emails: string[]) => {
    if (!inviteTask) {
      return;
    }

    try {
      setInviteLoading(true);
      setInviteError(null);
      await conservationApi.task.inviteProfilesToTask(inviteTask.task_id, { emails });
      setInviteTask(null);
    } catch (error) {
      console.error('Failed to invite profiles to task', error);
      setInviteError('Failed to send invites. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  const tasks = useMemo(() => {
    return (tasksDataLoader.data?.tasks ?? []).map((task) => ({
      ...task,
      status: taskStatuses[task.task_id] ?? task.status,
    }));
  }, [taskStatuses, tasksDataLoader.data]);

  const sidebarWidth = { xs: `calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px)`, md: SIDEBAR_FLOAT_WIDTH_PX };
  const sidebarMaxWidth = { xs: `calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px)`, md: SIDEBAR_FLOAT_WIDTH_PX };

  return (
    <Box position="relative" height="100%" overflow="hidden">
      <Box height="100%" display="flex" flexDirection="column" overflow="hidden">
        <MapContainer pmtilesUrls={[]} />
        <DrawControls ref={drawControlsRef} />
      </Box>

      <FloatingSidebarContainer width={sidebarWidth} maxWidth={sidebarMaxWidth}>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {isCreating ? (
            <CreateTask
              onClose={() => {
                navigate('/map');
              }}
              onSubmitSuccess={(task) => {
                navigate(`/t/${task.task_id}`);
              }}
            />
          ) : (
            <SidebarSection
              title="Tasks"
              onSearch={handleSearch}
              action={
                <Button
                  variant="contained"
                  startIcon={<Icon path={mdiPlus} size={0.75} />}
                  onClick={() => {
                    navigate('/map/new');
                  }}>
                  New
                </Button>
              }>
              <LoadingGuard
                isLoading={tasksDataLoader.isLoading && !tasksDataLoader.hasLoaded}
                isLoadingFallback={<SkeletonList numberOfLines={4} />}
                hasNoData={tasks.length === 0}
                hasNoDataFallback={
                  <Box display="flex" alignItems="center" justifyContent="center" p={5} bgcolor={grey[100]}>
                    <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                      No tasks yet
                    </Typography>
                  </Box>
                }>
                <List
                  dense
                  sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                  {tasks.map((task) => (
                    <MapTaskListItem
                      key={task.task_id}
                      task={task}
                      isUnseen={unseenTaskIds.has(task.task_id)}
                      onSelectTask={(selectedTask) => {
                        markTaskSeen(selectedTask.task_id);
                        navigate(`/t/${selectedTask.task_id}`);
                      }}
                      onDeleteTask={handleDeleteTask}
                      onShareTask={handleShareTask}
                      onEditTask={handleEditTask}
                    />
                  ))}
                </List>
              </LoadingGuard>
            </SidebarSection>
          )}
        </Box>
      </FloatingSidebarContainer>

      <TaskViewEditDialog
        open={Boolean(editTask)}
        task={editTask ?? undefined}
        isSaving={editTaskSaving}
        error={editTaskError}
        onCancel={() => {
          setEditTask(null);
          setEditTaskError(null);
        }}
        onSave={handleEditTaskSave}
      />

      <TaskViewInviteDialog
        open={Boolean(inviteTask)}
        task={inviteTask ?? undefined}
        isSubmitting={inviteLoading}
        error={inviteError}
        onClose={() => {
          setInviteTask(null);
        }}
        onSubmit={handleInviteSubmit}
      />
    </Box>
  );
};

interface MapTaskListItemProps {
  task: GetTaskResponse;
  isUnseen: boolean;
  onSelectTask: (task: GetTaskResponse) => void;
  onDeleteTask: (task: GetTaskResponse) => void;
  onShareTask: (task: GetTaskResponse) => void;
  onEditTask: (task: GetTaskResponse) => void;
}

const MapTaskListItem = ({
  task,
  isUnseen,
  onSelectTask,
  onDeleteTask,
  onShareTask,
  onEditTask,
}: MapTaskListItemProps) => {
  return (
    <ListItem key={task.task_id} disablePadding>
      <InteractiveListItemButton
        onClick={() => {
          onSelectTask(task);
        }}>
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
              <Typography fontWeight={700} noWrap>
                {task.name}
              </Typography>
              {isUnseen ? (
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flex: '0 0 auto' }} />
              ) : null}
            </Box>
          }
          secondary={task.description ?? undefined}
        />
        {task.status !== TASK_STATUS.DRAFT ? (
          <Chip size="small" label={getTaskStatusLabel(task.status)} sx={{ ml: 2, flex: '0 0 auto' }} />
        ) : null}
        <Box
          sx={{ ml: 1, flex: '0 0 auto' }}
          onClick={(event) => {
            event.stopPropagation();
          }}>
          <IconMenuButton
            items={[
              {
                label: 'Delete',
                icon: mdiDeleteOutline,
                onClick: () => {
                  onDeleteTask(task);
                },
              },
              {
                label: 'Share',
                icon: mdiAccountPlusOutline,
                onClick: () => {
                  onShareTask(task);
                },
              },
              {
                label: 'Edit',
                icon: mdiPencilOutline,
                onClick: () => {
                  onEditTask(task);
                },
              },
            ]}
          />
        </Box>
      </InteractiveListItemButton>
    </ListItem>
  );
};
