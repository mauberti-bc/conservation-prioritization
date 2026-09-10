import { mdiAccountPlusOutline, mdiDeleteOutline, mdiDownload, mdiPencilOutline, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { grey } from '@mui/material/colors';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { InteractiveListItemButton } from 'components/list/InteractiveListItemButton';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { TaskContext } from 'context/taskContext';
import { TASK_STATUS } from 'constants/status';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useApplicationEventsContext, useDialogContext, useMapContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { getTaskStatusLabel } from 'utils/task-status';
import { FloatingSidebarContainer } from '../sidebar/FloatingSidebarContainer';
import { SIDEBAR_FLOAT_MARGIN_PX, SIDEBAR_FLOAT_WIDTH_PX } from '../sidebar/sidebar-layout.constants';
import { SidebarSection } from '../sidebar/SidebarSection';
import { CreateTask } from '../task/create/CreateTask';
import { TaskViewEditDialog } from '../task/view/dialog/TaskViewEditDialog';
import { TaskViewInviteDialog } from '../task/view/dialog/TaskViewInviteDialog';
import { TaskViewPanel } from '../task/view/panel/TaskViewPanel';
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
  const location = useLocation();
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const { drawControlsRef } = useMapContext();
  const { connectionEpoch, markTaskSeen, taskRevisions, taskStatuses, unseenTaskIds } = useApplicationEventsContext();
  const tasksDataLoader = useDataLoader(conservationApi.task.getAllTasks);
  const taskDataLoader = useDataLoader(conservationApi.task.getTaskById);
  const refreshTasksRef = useRef(tasksDataLoader.refresh);
  const lastRequestedTaskIdRef = useRef<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredTilesetUri, setHoveredTilesetUri] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<GetTaskResponse | null>(null);
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const [editTaskError, setEditTaskError] = useState<string | null>(null);
  const [inviteTask, setInviteTask] = useState<GetTaskResponse | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const routeSegment = location.pathname.replace(/^\/map\/?/, '').split('/')[0] || null;
  const isCreating = mode === 'create' || routeSegment === 'new';
  const activeTaskId = routeSegment && routeSegment !== 'new' ? routeSegment : null;
  const activeTaskRevision = activeTaskId ? taskRevisions[activeTaskId] : undefined;
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

  useEffect(() => {
    if (!activeTaskId) {
      lastRequestedTaskIdRef.current = null;
      taskDataLoader.clearData();
      setHoveredTilesetUri(null);
      return;
    }

    if (taskDataLoader.isLoading || lastRequestedTaskIdRef.current === activeTaskId) {
      return;
    }

    lastRequestedTaskIdRef.current = activeTaskId;
    void taskDataLoader.refresh(activeTaskId);
  }, [activeTaskId, taskDataLoader]);

  useEffect(() => {
    if (!activeTaskId) {
      return;
    }

    if (!activeTaskRevision || !taskDataLoader.hasLoaded) {
      return;
    }

    void taskDataLoader.refresh(activeTaskId);
    markTaskSeen(activeTaskId);
    // The loader is intentionally refreshed only when the authoritative revision changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskId, activeTaskRevision, markTaskSeen]);

  useEffect(() => {
    if (!activeTaskId || !connectionEpoch || !taskDataLoader.hasLoaded) {
      return;
    }

    void taskDataLoader.refresh(activeTaskId);
    // Reconnect recovery is authoritative REST refetch, not event replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskId, connectionEpoch]);

  const handleSearch = (term: string) => {
    const trimmedTerm = term.trim();
    setSearchTerm(trimmedTerm);
    void tasksDataLoader.refresh({
      ...defaultPagination,
      search: trimmedTerm || undefined,
    });
  };

  const refreshMapTasks = useCallback(async () => {
    return tasksDataLoader.refresh({
      ...defaultPagination,
      search: searchTerm || undefined,
    });
  }, [searchTerm, tasksDataLoader]);

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

  const handleDownloadTask = (task: GetTaskResponse) => {
    void task;

    dialogContext.setSnackbar({
      open: true,
      snackbarMessage: 'Task export download is not available yet.',
    });
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

  const activeTaskData = useMemo(() => {
    if (!activeTaskId || !taskDataLoader.data || taskDataLoader.data.task_id !== activeTaskId) {
      return null;
    }

    return {
      ...taskDataLoader.data,
      status: taskStatuses[activeTaskId] ?? taskDataLoader.data.status,
    };
  }, [activeTaskId, taskDataLoader.data, taskStatuses]);

  const referenceDecisionUri = useMemo(() => {
    const decision = activeTaskData?.latest_run?.artifacts?.find(
      (artifact) => artifact.type === 'pmtiles' && artifact.status === 'ready'
    );
    return decision?.uri ?? null;
  }, [activeTaskData]);

  const resolvedPmtilesUri = referenceDecisionUri ?? activeTaskData?.tileset_uri ?? null;

  const pmtilesUrls = useMemo(() => {
    const baseUrls = resolvedPmtilesUri ? [resolvedPmtilesUri] : [];

    if (hoveredTilesetUri) {
      if (baseUrls.includes(hoveredTilesetUri)) {
        return baseUrls;
      }
      return [hoveredTilesetUri, ...baseUrls];
    }

    return baseUrls;
  }, [hoveredTilesetUri, resolvedPmtilesUri]);

  const showStatusChip = useMemo(() => {
    const activeStatus = activeTaskData?.status;
    const hasPmtilesUri = Boolean(activeTaskData?.tileset_uri);
    if (!activeStatus) {
      return false;
    }

    if (activeStatus === TASK_STATUS.DRAFT) {
      return false;
    }

    if (activeStatus === TASK_STATUS.COMPLETED) {
      return !hasPmtilesUri;
    }

    return true;
  }, [activeTaskData]);

  const statusChipLabel = useMemo(() => {
    const activeStatus = activeTaskData?.status;
    const hasPmtilesUri = Boolean(activeTaskData?.tileset_uri);

    if (activeStatus === TASK_STATUS.COMPLETED && !hasPmtilesUri) {
      return 'Building map';
    }

    const stage = activeTaskData?.latest_run?.stage;
    if (stage === 'counting') {
      return 'Counting planning units';
    }
    if (stage === 'preparing') {
      return 'Preparing data';
    }
    if (stage === 'compiling') {
      return 'Compiling model';
    }
    if (stage === 'admitting') {
      return 'Checking capacity';
    }
    if (stage === 'solving') {
      return 'Optimizing';
    }
    if (stage === 'materializing') {
      return 'Saving result';
    }
    if (stage === 'exporting') {
      return 'Building export';
    }
    if (stage === 'publishing') {
      return 'Building map';
    }

    return 'Processing';
  }, [activeTaskData]);

  const refreshTasks = useCallback(async () => {
    return refreshMapTasks();
  }, [refreshMapTasks]);

  const setFocusedTask = useCallback(
    (task: GetTaskResponse | null) => {
      setHoveredTilesetUri(null);
      if (task) {
        taskDataLoader.setData(task);
        navigate(`/map/${task.task_id}`);
        return;
      }

      taskDataLoader.clearData();
      navigate('/map');
    },
    [navigate, taskDataLoader]
  );

  const taskContext = useMemo(() => {
    return {
      taskDataLoader,
      tasksDataLoader,
      taskId: activeTaskId ?? '',
      setFocusedTask,
      refreshTasks,
      hoveredTilesetUri,
      setHoveredTilesetUri,
    };
  }, [activeTaskId, hoveredTilesetUri, refreshTasks, setFocusedTask, taskDataLoader, tasksDataLoader]);

  const sidebarWidth = { xs: `calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px)`, md: SIDEBAR_FLOAT_WIDTH_PX };
  const sidebarMaxWidth = { xs: `calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px)`, md: SIDEBAR_FLOAT_WIDTH_PX };
  const statusChipLeft = `calc((100% + ${SIDEBAR_FLOAT_MARGIN_PX + SIDEBAR_FLOAT_WIDTH_PX}px) / 2)`;

  return (
    <Box position="relative" height="100%" overflow="hidden">
      <Box height="100%" display="flex" flexDirection="column" overflow="hidden">
        {activeTaskId && showStatusChip ? (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: { xs: '50%', md: statusChipLeft },
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}>
            <Chip
              size="medium"
              color="primary"
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  {statusChipLabel}
                  <CircularProgress size={12} color="inherit" thickness={7} />
                </Box>
              }
              sx={{
                fontWeight: 700,
                fontSize: '1rem',
                px: 2,
                py: 2.5,
                boxShadow: 3,
              }}
            />
          </Box>
        ) : null}
        <MapContainer
          pmtilesUrls={pmtilesUrls}
          boundsRefreshKey={activeTaskId ?? undefined}
          pmtilesLegendTaskType={activeTaskData?.type ?? null}
        />
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
                void task;
                navigate('/map');
                void refreshMapTasks();
              }}
            />
          ) : activeTaskId ? (
            <TaskContext.Provider value={taskContext}>
              <TaskViewPanel />
            </TaskContext.Provider>
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
                        navigate(`/map/${selectedTask.task_id}`);
                      }}
                      onDeleteTask={handleDeleteTask}
                      onShareTask={handleShareTask}
                      onEditTask={handleEditTask}
                      onDownloadTask={handleDownloadTask}
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
  onDownloadTask: (task: GetTaskResponse) => void;
}

const MapTaskListItem = ({
  task,
  isUnseen,
  onSelectTask,
  onDeleteTask,
  onShareTask,
  onEditTask,
  onDownloadTask,
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
          sx={{ ml: 1, flex: '0 0 auto', display: 'flex', alignItems: 'center' }}
          onClick={(event) => {
            event.stopPropagation();
          }}>
          <IconButton
            aria-label="Download task export"
            size="small"
            onClick={() => {
              onDownloadTask(task);
            }}>
            <Icon path={mdiDownload} size={0.75} />
          </IconButton>
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
