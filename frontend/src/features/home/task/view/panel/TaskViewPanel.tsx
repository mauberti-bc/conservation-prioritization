import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TaskCreateForm, TaskCreateFormValues } from 'features/home/task/create/form/TaskCreateForm';
import { Formik } from 'formik';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useTaskContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
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
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const { taskId, taskDataLoader, refreshTasks, setFocusedTask } = useTaskContext();
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const [editTaskError, setEditTaskError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

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
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <TaskViewPanelHeader
                title={taskDataLoader.data?.name ?? 'Task'}
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

              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  height: '100%',
                  overflow: 'auto',
                }}>
                <TaskCreateForm isReadOnly autoSearchOnMount={false} showAreaSection={false} showLayersSection />
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
