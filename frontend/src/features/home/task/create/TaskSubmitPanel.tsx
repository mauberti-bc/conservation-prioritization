import { mdiCheck } from '@mdi/js';
import Icon from '@mdi/react';
import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { EditDialog } from 'components/dialog/EditDialog';
import { InviteDialog } from 'components/dialog/InviteDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { Formik } from 'formik';
import { CreateDraftTaskRequest, CreateTaskLayer } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useTaskContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { mapTaskResponseToSubmitFormValues } from 'utils/task-mapping';
import * as Yup from 'yup';
import { TaskCreateForm, TaskCreateFormValues } from './form/TaskCreateForm';
import { TaskSubmitPanelFooter } from './panel/footer/TaskSubmitPanelFooter';
import { TaskSubmitPanelHeader } from './panel/header/TaskSubmitPanelHeader';
import { TaskSubmitEditFormValues } from './panel/task-submit-panel.interface';
import { TaskSubmitPanelEditForm } from './panel/TaskSubmitPanelEditForm';
import { taskValidationSchema } from './TaskCreateYup';

const taskEditSchema = Yup.object({
  name: Yup.string().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: Yup.string().max(500, 'Description must be 500 characters or less'),
});

/**
 * Sidebar panel for submitting an existing task.
 *
 * @returns {JSX.Element}
 */
export const TaskSubmitPanel = () => {
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const { taskId, taskDataLoader, refreshTasks, setFocusedTask } = useTaskContext();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
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

  const handleSubmit = async (values: TaskCreateFormValues) => {
    if (!taskId) {
      return;
    }

    setIsSubmitting(true);

    try {
      const mappedLayers: CreateTaskLayer[] = values.layers.map((layer) => ({
        layer_name: layer.path,
        description: null,
        mode: layer.mode,
        importance: layer.mode === 'flexible' ? layer.importance : undefined,
        threshold: layer.mode === 'locked-in' || layer.mode === 'locked-out' ? layer.threshold : undefined,
        constraints: layer.constraints.map((constraint) => ({
          min: constraint.min ?? null,
          max: constraint.max ?? null,
          type: constraint.type,
        })),
      }));

      const mappedBudget: CreateTaskLayer | undefined = values.budget
        ? {
            layer_name: values.budget.path,
            description: null,
            mode: values.budget.mode,
            importance: values.budget.importance ?? null,
            threshold: values.budget.threshold ?? null,
            constraints: values.budget.constraints.map((constraint) => ({
              min: constraint.min ?? null,
              max: constraint.max ?? null,
              type: constraint.type,
            })),
          }
        : undefined;

      const draftTaskData: CreateDraftTaskRequest = {
        name: values.name,
        description: values.description ?? null,
      };

      const createdDraftTask = await conservationApi.task.createTask(draftTaskData);
      const updatedTask = await conservationApi.task.submitTask(createdDraftTask.task_id, {
        layers: mappedLayers,
        budget: mappedBudget,
        resolution: values.resolution,
        resampling: values.resampling,
        variant: values.variant,
        geometry: values.geometry.length
          ? values.geometry.map((geometry) => ({
              name: geometry.name,
              description: geometry.description,
              geojson: geometry.geojson,
            }))
          : undefined,
      });

      setFocusedTask(updatedTask);
      taskDataLoader.setData(updatedTask);
      await refreshTasks();

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (
          <Stack flexDirection="row" gap={1}>
            <Icon path={mdiCheck} size={1} />
            Successfully created and submitted task
          </Stack>
        ),
      });
    } catch (error) {
      console.error(error);
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Failed to submit task',
      });
    } finally {
      setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    }
  };

  const handleEditTaskSave = async (values: TaskSubmitEditFormValues) => {
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
            <Typography color="text.secondary">Select a task to submit.</Typography>
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
          <Formik
            initialValues={initialValues as TaskCreateFormValues}
            enableReinitialize
            onSubmit={handleSubmit}
            validationSchema={taskValidationSchema}
            validateOnChange={false}
            validateOnMount={false}
            validateOnBlur={false}>
            {({ handleSubmit }) => {
              return (
                <Box
                  component="form"
                  onSubmit={handleSubmit}
                  sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                  <TaskSubmitPanelHeader
                    title={taskDataLoader.data?.name ?? 'Task'}
                    onBack={() => {
                      setFocusedTask(null);
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
                  <Box
                    sx={{
                      flex: 1,
                      py: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                      height: '100%',
                      overflow: 'auto',
                    }}>
                    <TaskCreateForm autoSearchOnMount showAdvancedSection={false} />
                  </Box>

                  <TaskSubmitPanelFooter isSubmitting={isSubmitting} />
                </Box>
              );
            }}
          </Formik>
        </LoadingGuard>
      </LoadingGuard>
      <EditDialog<TaskSubmitEditFormValues>
        open={editTaskOpen}
        dialogTitle="Edit Task"
        dialogText="Update the task name and description."
        dialogSaveButtonLabel="Save"
        size="sm"
        dialogLoading={editTaskSaving}
        dialogError={editTaskError ?? undefined}
        onCancel={() => {
          setEditTaskOpen(false);
          setEditTaskError(null);
        }}
        onSave={handleEditTaskSave}
        component={{
          element: <TaskSubmitPanelEditForm />,
          initialValues: {
            name: taskDataLoader.data?.name ?? '',
            description: taskDataLoader.data?.description ?? '',
          },
          validationSchema: taskEditSchema,
        }}
      />
      <InviteDialog
        open={inviteOpen}
        title={taskDataLoader.data ? `Invite to ${taskDataLoader.data.name}` : 'Invite to Task'}
        description="Enter email addresses to add existing profiles to this task."
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
