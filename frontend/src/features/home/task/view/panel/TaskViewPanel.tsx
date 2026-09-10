import { Alert, Button, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TaskCreateForm, TaskCreateFormValues } from 'features/home/task/create/form/TaskCreateForm';
import { TaskViewPanelSkeleton } from 'features/skeleton/TaskViewPanelSkeleton';
import { Formik } from 'formik';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useTaskContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mapTaskResponseToSubmitFormValues } from 'utils/task-mapping';
import { TaskViewEditDialog } from '../dialog/TaskViewEditDialog';
import { TaskViewInviteDialog } from '../dialog/TaskViewInviteDialog';
import { TaskViewPanelHeader } from './TaskViewPanelHeader';
import { TaskEditFormValues, TaskSolutionSummaryRow } from './task-view-panel.interface';

/**
 * Read-only task sidebar content for viewing an existing task.
 *
 * @returns {JSX.Element}
 */
export const TaskViewPanel = () => {
  const navigate = useNavigate();
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const { taskId, taskDataLoader, onDownloadTask, refreshTasks, setFocusedTask } = useTaskContext();
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const [editTaskError, setEditTaskError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [retryingPublication, setRetryingPublication] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const initialValues = useMemo<TaskCreateFormValues | null>(() => {
    if (!taskDataLoader.data) {
      return null;
    }

    return mapTaskResponseToSubmitFormValues(taskDataLoader.data);
  }, [taskDataLoader.data]);

  const handleEditTaskSave = async (values: TaskEditFormValues) => {
    if (!taskId) {
      return;
    }

    try {
      setEditTaskSaving(true);
      setEditTaskError(null);

      const updatedTask = await conservationApi.task.updateTask(taskId, {
        name: values.name,
        description: values.description.trim() ? values.description : null,
      });

      taskDataLoader.setData(updatedTask);
      await refreshTasks();
      setEditTaskOpen(false);
    } catch (error) {
      console.error('Failed to update task', error);
      setEditTaskError('Failed to update task. Please try again.');
    } finally {
      setEditTaskSaving(false);
    }
  };

  const handleInviteSubmit = async (emails: string[]) => {
    if (!taskId) {
      return;
    }

    try {
      setInviteLoading(true);
      setInviteError(null);

      await conservationApi.task.inviteProfilesToTask(taskId, { emails });
      setInviteOpen(false);
    } catch (error) {
      console.error('Failed to invite profiles to task', error);
      setInviteError('Failed to send invites. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  /** Requests cancellation for the displayed task and reloads its server status. */
  const handleAbortTask = async () => {
    if (!taskId) {
      return;
    }

    try {
      await conservationApi.task.abortTask(taskId);
      dialogContext.setSnackbar({ open: true, snackbarMessage: 'Abort requested.' });
    } catch (error) {
      console.error('Failed to abort task', error);
      dialogContext.setSnackbar({ open: true, snackbarMessage: 'Failed to abort task. Please try again.' });
      return;
    }

    await taskDataLoader.refresh(taskId);
    await refreshTasks();
  };

  const handleDeleteTask = () => {
    if (!taskId || !taskDataLoader.data) {
      return;
    }

    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete Task?',
      dialogText: `Are you sure you want to delete "${taskDataLoader.data.name}"?`,
      onYes: async () => {
        dialogContext.setYesNoDialog({ open: false });
        await conservationApi.task.deleteTask(taskId);
        setFocusedTask(null);
        await refreshTasks();
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
    });
  };

  const canRetryPublication = useMemo(() => {
    const run = taskDataLoader.data?.latest_run;
    if (!run || run.status !== 'failed') {
      return false;
    }
    const canonical = run.artifacts?.find((artifact) => artifact.type === 'canonical_result');
    const pmtiles = run.artifacts?.find((artifact) => artifact.type === 'pmtiles');
    return canonical?.status === 'ready' && pmtiles?.status !== 'ready';
  }, [taskDataLoader.data?.latest_run]);

  const solutionSummary = useMemo(() => {
    const run = taskDataLoader.data?.latest_run;
    if (!run || !run.solutions?.length) {
      return null;
    }
    const reference = run.solutions.find((solution) => solution.role === 'reference');
    const allocationTotal =
      typeof reference?.metrics?.allocation_total === 'number' ? reference.metrics.allocation_total : null;
    const priorityTotal =
      typeof reference?.metrics?.priority_total === 'number' ? reference.metrics.priority_total : null;
    return {
      count: run.solutions.length,
      objective: reference?.objective_value ?? null,
      resource: reference?.resource_value ?? null,
      selectedCount: reference?.selected_planning_unit_count ?? null,
      allocationTotal,
      priorityTotal,
      gap: reference?.optimality_gap ?? null,
      method: `${run.execution_method} · ${run.execution_method_version}`,
      taskType: run.task_type,
    };
  }, [taskDataLoader.data?.latest_run]);

  const solutionSummaryRows = useMemo<TaskSolutionSummaryRow[]>(() => {
    if (!solutionSummary) {
      return [];
    }

    const rows: TaskSolutionSummaryRow[] = [
      { label: 'Solutions', value: solutionSummary.count },
      { label: 'Method', value: solutionSummary.method },
    ];

    if (solutionSummary.objective !== null) {
      rows.push({ label: 'Reference objective', value: solutionSummary.objective });
    }

    if (solutionSummary.resource !== null) {
      rows.push({ label: 'Reference resource use', value: solutionSummary.resource });
    }

    if (solutionSummary.taskType === 'discrete_optimization' && solutionSummary.selectedCount !== null) {
      rows.push({ label: 'Selected planning units', value: solutionSummary.selectedCount });
    }

    if (solutionSummary.taskType === 'continuous_optimization' && solutionSummary.allocationTotal !== null) {
      rows.push({ label: 'Total allocation intensity', value: solutionSummary.allocationTotal });
    }

    if (solutionSummary.taskType === 'priority_ranking' && solutionSummary.priorityTotal !== null) {
      rows.push({ label: 'Total nested priority score', value: solutionSummary.priorityTotal });
    }

    if (solutionSummary.gap !== null) {
      rows.push({ label: 'Optimality gap', value: solutionSummary.gap });
    }

    return rows;
  }, [solutionSummary]);

  /** Retries only the failed map-publication stage for the current run. */
  const handleRetryPublication = async () => {
    const runId = taskDataLoader.data?.latest_run?.task_run_id;
    if (!runId) {
      return;
    }
    try {
      setRetryingPublication(true);
      setRetryError(null);
      await conservationApi.task.retryTaskRunPublication(runId);
      await taskDataLoader.refresh(taskId);
    } catch (error) {
      console.error('Failed to retry task publication', error);
      setRetryError('Map publication could not be restarted. Please try again.');
    } finally {
      setRetryingPublication(false);
    }
  };

  return (
    <>
      <LoadingGuard
        isLoading={Boolean(taskId) && (taskDataLoader.isLoading || !taskDataLoader.hasLoaded)}
        isLoadingFallback={<TaskViewPanelSkeleton />}
        hasNoData={!taskId}
        hasNoDataFallback={
          <Box p={3}>
            <Typography color="text.secondary">Select a task to view.</Typography>
          </Box>
        }>
        <LoadingGuard
          isLoading={false}
          hasNoData={Boolean(taskDataLoader.error || !initialValues)}
          hasNoDataFallback={
            <Box p={3}>
              <Typography color="error">Failed to load task.</Typography>
            </Box>
          }>
          <Formik initialValues={initialValues as TaskCreateFormValues} enableReinitialize onSubmit={async () => {}}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
              <Box sx={{ px: 3, pt: 3, flex: '0 0 auto' }}>
                <TaskViewPanelHeader
                  title={taskDataLoader.data?.name ?? 'Task'}
                  status={taskDataLoader.data?.status}
                  onClose={() => {
                    navigate('/map');
                  }}
                  onEdit={() => {
                    setEditTaskError(null);
                    setEditTaskOpen(true);
                  }}
                  onShare={() => {
                    setInviteError(null);
                    setInviteOpen(true);
                  }}
                  onAbort={handleAbortTask}
                  onDelete={handleDeleteTask}
                />
              </Box>

              {solutionSummary && (
                <Box sx={{ mx: 3, mb: 2, p: 1.5, borderRadius: 1, bgcolor: 'action.hover', flex: '0 0 auto' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {solutionSummaryRows.map((row) => (
                      <Box
                        key={row.label}
                        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {row.label}
                        </Typography>
                        <Typography variant="body2" textAlign="right">
                          {row.value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  px: 3,
                  pt: 0,
                  pb: 3,
                }}>
                {taskDataLoader.data?.latest_run?.status === 'failed' && (
                  <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    action={
                      canRetryPublication ? (
                        <Button
                          color="inherit"
                          size="small"
                          disabled={retryingPublication}
                          onClick={() => {
                            void handleRetryPublication();
                          }}>
                          {retryingPublication ? 'Retrying…' : 'Retry map'}
                        </Button>
                      ) : undefined
                    }>
                    {retryError ?? taskDataLoader.data.latest_run.failure_message ?? 'This run failed.'}
                  </Alert>
                )}
                <TaskCreateForm isReadOnly autoSearchOnMount={false} />
              </Box>

              <Box
                sx={{
                  px: 3,
                  py: 2,
                  boxShadow: '0px -2px 25px 0px rgba(0,0,0,0.05)',
                  backgroundColor: 'white',
                  flex: '0 0 auto',
                }}>
                <Button
                  sx={{ py: 2 }}
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={() => {
                    if (taskDataLoader.data) {
                      onDownloadTask(taskDataLoader.data);
                    }
                  }}>
                  Export
                </Button>
              </Box>
            </Box>
          </Formik>
        </LoadingGuard>
      </LoadingGuard>

      <TaskViewEditDialog
        open={editTaskOpen}
        task={taskDataLoader.data}
        isSaving={editTaskSaving}
        error={editTaskError}
        onCancel={() => {
          setEditTaskOpen(false);
          setEditTaskError(null);
        }}
        onSave={handleEditTaskSave}
      />

      <TaskViewInviteDialog
        open={inviteOpen}
        task={taskDataLoader.data}
        onClose={() => {
          setInviteOpen(false);
        }}
        onSubmit={handleInviteSubmit}
        isSubmitting={inviteLoading}
        error={inviteError}
      />
    </>
  );
};
