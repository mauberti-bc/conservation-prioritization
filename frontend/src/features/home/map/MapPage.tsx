import { mdiAccountPlusOutline, mdiDeleteOutline, mdiDownload, mdiPencilOutline, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { grey } from '@mui/material/colors';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { TaskStatusChip } from 'components/chip/TaskStatusChip';
import { InteractiveListItemButton } from 'components/list/InteractiveListItemButton';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { CustomPagination } from 'components/pagination/CustomPagination';
import { TASK_STATUS } from 'constants/status';
import { TaskContext } from 'context/taskContext';
import { GetTaskResponse, TaskExportFormat } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useApplicationEventsContext, useDialogContext, useMapContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { getLatestTaskExport, getTaskExportAction, triggerBrowserDownload } from 'utils/task-export';
import { FloatingSidebarContainer } from '../sidebar/FloatingSidebarContainer';
import { SIDEBAR_FLOAT_MARGIN_PX, SIDEBAR_FLOAT_WIDTH_PX } from '../sidebar/sidebar-layout.constants';
import { SidebarSection } from '../sidebar/SidebarSection';
import { CreateTask } from '../task/create/CreateTask';
import { TaskExportFormatDialog } from '../task/export/TaskExportFormatDialog';
import { TaskViewEditDialog } from '../task/view/dialog/TaskViewEditDialog';
import { TaskViewInviteDialog } from '../task/view/dialog/TaskViewInviteDialog';
import { TaskEditFormValues } from '../task/view/panel/task-view-panel.interface';
import { TaskViewPanel } from '../task/view/panel/TaskViewPanel';
import { DrawControls } from './draw/DrawControls';
import { MapContainer } from './MapContainer';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT = 'created_at';
const DEFAULT_ORDER = 'desc';

const makeTaskPaginationOptions = (page: number, limit: number, searchTerm: string): ApiPaginationRequestOptions => {
  return {
    page,
    limit,
    sort: DEFAULT_SORT,
    order: DEFAULT_ORDER,
    search: searchTerm || undefined,
  };
};

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
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
  const { connectionEpoch, markTaskSeen, taskRevisions, taskStatuses } = useApplicationEventsContext();
  const tasksDataLoader = useDataLoader(conservationApi.task.getAllTasks);
  const taskDataLoader = useDataLoader(conservationApi.task.getTaskById);
  const refreshTasksRef = useRef(tasksDataLoader.refresh);
  const refreshTaskRef = useRef(taskDataLoader.refresh);
  const clearTaskRef = useRef(taskDataLoader.clearData);
  const setTaskDataRef = useRef(taskDataLoader.setData);
  const lastRequestedTaskIdRef = useRef<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hoveredTilesetUri, setHoveredTilesetUri] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<GetTaskResponse | null>(null);
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const [editTaskError, setEditTaskError] = useState<string | null>(null);
  const [inviteTask, setInviteTask] = useState<GetTaskResponse | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [exportTask, setExportTask] = useState<GetTaskResponse | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const routeSegment = location.pathname.replace(/^\/map\/?/, '').split('/')[0] || null;
  const isCreating = mode === 'create' || routeSegment === 'new';
  const activeTaskId = routeSegment && routeSegment !== 'new' ? routeSegment : null;
  const activeTaskRevision = activeTaskId ? taskRevisions[activeTaskId] : undefined;
  const taskPaginationOptions = useMemo(() => {
    return makeTaskPaginationOptions(currentPage, pageSize, searchTerm);
  }, [currentPage, pageSize, searchTerm]);
  refreshTasksRef.current = tasksDataLoader.refresh;
  refreshTaskRef.current = taskDataLoader.refresh;
  clearTaskRef.current = taskDataLoader.clearData;
  setTaskDataRef.current = taskDataLoader.setData;
  const hasLoadedActiveTask = taskDataLoader.hasLoaded;

  useEffect(() => {
    void refreshTasksRef.current(taskPaginationOptions);
  }, [taskPaginationOptions]);

  useEffect(() => {
    if (!connectionEpoch) {
      return;
    }

    void refreshTasksRef.current(taskPaginationOptions);
  }, [connectionEpoch, taskPaginationOptions]);

  useEffect(() => {
    if (!activeTaskId) {
      if (lastRequestedTaskIdRef.current) {
        lastRequestedTaskIdRef.current = null;
        clearTaskRef.current();
      }
      setHoveredTilesetUri(null);
      return;
    }

    if (lastRequestedTaskIdRef.current === activeTaskId) {
      return;
    }

    lastRequestedTaskIdRef.current = activeTaskId;
    void refreshTaskRef.current(activeTaskId);
  }, [activeTaskId]);

  useEffect(() => {
    if (!activeTaskId) {
      return;
    }

    if (!activeTaskRevision || !hasLoadedActiveTask) {
      return;
    }

    void refreshTaskRef.current(activeTaskId);
    markTaskSeen(activeTaskId);
  }, [activeTaskId, activeTaskRevision, hasLoadedActiveTask, markTaskSeen]);

  useEffect(() => {
    if (!activeTaskId || !connectionEpoch || !hasLoadedActiveTask) {
      return;
    }

    void refreshTaskRef.current(activeTaskId);
  }, [activeTaskId, connectionEpoch, hasLoadedActiveTask]);

  const handleSearch = (term: string) => {
    const trimmedTerm = term.trim();
    setCurrentPage(DEFAULT_PAGE);
    setSearchTerm(trimmedTerm);
  };

  const refreshMapTasks = useCallback(async () => {
    return refreshTasksRef.current(taskPaginationOptions);
  }, [taskPaginationOptions]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setCurrentPage(DEFAULT_PAGE);
    setPageSize(nextPageSize);
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

  const handleDownloadTask = useCallback(
    async (task: GetTaskResponse) => {
      const run = task.latest_run;
      const action = getTaskExportAction(task);
      if (!run || action === 'unavailable') {
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: 'Exports are available after a task run is completed.',
        });
        return;
      }

      if (action === 'preparing') {
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: 'An export is already being prepared.',
        });
        return;
      }

      const latestExport = getLatestTaskExport(task);
      if (action === 'download' && latestExport) {
        if (!latestExport.files.length) {
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: 'This export has no downloadable files.',
          });
          return;
        }

        try {
          for (const file of latestExport.files) {
            const download = await conservationApi.task.getTaskExportFileDownload(
              run.task_run_id,
              latestExport.task_export_id,
              file.task_export_file_id
            );
            triggerBrowserDownload(download.url, file.filename);
          }
        } catch (error) {
          console.error('Failed to download task export', error);
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: getErrorMessage(error, 'Failed to download export. Please try again.'),
          });
        }
        return;
      }

      setExportError(null);
      setExportTask(task);
    },
    [conservationApi.task, dialogContext]
  );

  const handleExportFormatSubmit = useCallback(
    async (format: TaskExportFormat) => {
      const runId = exportTask?.latest_run?.task_run_id;
      if (!exportTask || !runId) {
        return;
      }

      try {
        setExportLoading(true);
        setExportError(null);
        await conservationApi.task.createTaskExport(runId, { format });
        await refreshMapTasks();
        if (activeTaskId === exportTask.task_id) {
          await refreshTaskRef.current(exportTask.task_id);
        }
        setExportTask(null);
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: 'Export is being prepared.',
        });
      } catch (error) {
        console.error('Failed to create task export', error);
        setExportError(getErrorMessage(error, 'Failed to create export. Please try again.'));
      } finally {
        setExportLoading(false);
      }
    },
    [activeTaskId, conservationApi.task, dialogContext, exportTask, refreshMapTasks]
  );

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
  const taskPagination = tasksDataLoader.data?.pagination;

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
        setTaskDataRef.current(task);
        navigate(`/map/${task.task_id}`);
        return;
      }

      clearTaskRef.current();
      navigate('/map');
    },
    [navigate]
  );

  const taskContext = useMemo(() => {
    return {
      taskDataLoader,
      tasksDataLoader,
      taskId: activeTaskId ?? '',
      setFocusedTask,
      onDownloadTask: (task: GetTaskResponse) => {
        void handleDownloadTask(task);
      },
      refreshTasks,
      hoveredTilesetUri,
      setHoveredTilesetUri,
    };
  }, [
    activeTaskId,
    handleDownloadTask,
    hoveredTilesetUri,
    refreshTasks,
    setFocusedTask,
    taskDataLoader,
    tasksDataLoader,
  ]);

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
                {taskPagination ? (
                  <CustomPagination
                    currentPage={taskPagination.current_page}
                    pageSize={taskPagination.per_page ?? pageSize}
                    totalCount={taskPagination.total}
                    lastPage={taskPagination.last_page}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                  />
                ) : null}
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

      <TaskExportFormatDialog
        open={Boolean(exportTask)}
        isSubmitting={exportLoading}
        error={exportError}
        onClose={() => {
          if (!exportLoading) {
            setExportTask(null);
            setExportError(null);
          }
        }}
        onSubmit={handleExportFormatSubmit}
      />
    </Box>
  );
};

interface MapTaskListItemProps {
  task: GetTaskResponse;
  onSelectTask: (task: GetTaskResponse) => void;
  onDeleteTask: (task: GetTaskResponse) => void;
  onShareTask: (task: GetTaskResponse) => void;
  onEditTask: (task: GetTaskResponse) => void;
  onDownloadTask: (task: GetTaskResponse) => void;
}

const MapTaskListItem = ({
  task,
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
            </Box>
          }
          secondary={task.description ?? undefined}
        />
        {task.status !== TASK_STATUS.DRAFT ? (
          <TaskStatusChip status={task.status} sx={{ ml: 2, flex: '0 0 auto' }} />
        ) : null}
        <Box
          sx={{ ml: 1, flex: '0 0 auto', display: 'flex', alignItems: 'center' }}
          onClick={(event) => {
            event.stopPropagation();
          }}>
          <IconMenuButton
            items={[
              {
                label: 'Export',
                icon: mdiDownload,
                onClick: () => {
                  void onDownloadTask(task);
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
              {
                label: 'Delete',
                icon: mdiDeleteOutline,
                color: 'error',
                dividerBefore: true,
                onClick: () => {
                  onDeleteTask(task);
                },
              },
            ]}
          />
        </Box>
      </InteractiveListItemButton>
    </ListItem>
  );
};
