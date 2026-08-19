import { Alert, Button, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TaskCreateForm, TaskCreateFormValues } from 'features/home/task/create/form/TaskCreateForm';
import { Formik } from 'formik';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useTaskContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mapTaskResponseToSubmitFormValues } from 'utils/task-mapping';
import { TaskViewEditDialog } from '../dialog/TaskViewEditDialog';
import { TaskViewInviteDialog } from '../dialog/TaskViewInviteDialog';
import { TaskViewPanelHeader } from './TaskViewPanelHeader';
import { TaskEditFormValues } from './task-view-panel.interface';

/**
 * Read-only task sidebar content for viewing an existing task.
 *
 * @returns {JSX.Element}
 */
export const TaskViewPanel = () => {
  const navigate = useNavigate();
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const { taskId, taskDataLoader, refreshTasks, setFocusedTask } = useTaskContext();
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
      title: run.task_type === 'priority_ranking' ? 'Priority ranking' : 'Reference solution',
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
        isLoadingFallback={
          <Box p={3}>
            <Typography>Loading task...</Typography>
          </Box>
        }
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
              <Box sx={{ px: 3, pt: 3, pb: 2, flex: '0 0 auto' }}>
                <TaskViewPanelHeader
                  title={taskDataLoader.data?.name ?? 'Task'}
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
                  onDelete={handleDeleteTask}
                />
              </Box>

              {solutionSummary && (
                <Box sx={{ mx: 3, mb: 2, p: 1.5, borderRadius: 1, bgcolor: 'action.hover', flex: '0 0 auto' }}>
                  <Typography variant="subtitle2">{solutionSummary.title}</Typography>
                  <Typography variant="body2">Solutions: {solutionSummary.count}</Typography>
                  <Typography variant="body2">Method: {solutionSummary.method}</Typography>
                  {solutionSummary.objective !== null && (
                    <Typography variant="body2">Reference objective: {solutionSummary.objective}</Typography>
                  )}
                  {solutionSummary.resource !== null && (
                    <Typography variant="body2">Reference resource use: {solutionSummary.resource}</Typography>
                  )}
                  {solutionSummary.taskType === 'discrete_optimization' && solutionSummary.selectedCount !== null && (
                    <Typography variant="body2">Selected planning units: {solutionSummary.selectedCount}</Typography>
                  )}
                  {solutionSummary.taskType === 'continuous_optimization' &&
                    solutionSummary.allocationTotal !== null && (
                      <Typography variant="body2">
                        Total allocation intensity: {solutionSummary.allocationTotal}
                      </Typography>
                    )}
                  {solutionSummary.taskType === 'priority_ranking' && solutionSummary.priorityTotal !== null && (
                    <Typography variant="body2">
                      Total nested priority score: {solutionSummary.priorityTotal}
                    </Typography>
                  )}
                  {solutionSummary.gap !== null && (
                    <Typography variant="body2">Optimality gap: {solutionSummary.gap}</Typography>
                  )}
                </Box>
              )}

              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  px: 3,
                  pt: 1,
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
                <TaskCreateForm isReadOnly autoSearchOnMount={false} showAreaSection={false} />
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
