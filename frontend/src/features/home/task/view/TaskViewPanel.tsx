import { mdiAccountPlusOutline, mdiDeleteOutline, mdiPencilOutline } from '@mdi/js';
import { TextField, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { EditDialog } from 'components/dialog/EditDialog';
import { InviteDialog } from 'components/dialog/InviteDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { Formik, useFormikContext } from 'formik';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useTaskContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { mapTaskResponseToSubmitFormValues } from 'utils/task-mapping';
import * as Yup from 'yup';
import { TaskCreateForm, TaskCreateFormValues } from '../create/form/TaskCreateForm';

interface TaskEditFormValues {
  name: string;
  description: string;
}

const taskEditSchema = Yup.object({
  name: Yup.string().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: Yup.string().max(500, 'Description must be 500 characters or less'),
});

const TaskEditForm = () => {
  const { values, errors, touched, handleChange, handleBlur } = useFormikContext<TaskEditFormValues>();

  return (
    <Stack spacing={2}>
      <TextField
        fullWidth
        id="name"
        name="name"
        label="Name"
        value={values.name}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.name && Boolean(errors.name)}
        helperText={touched.name && errors.name ? errors.name : ''}
        required
      />
      <TextField
        fullWidth
        id="description"
        name="description"
        label="Description"
        value={values.description}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.description && Boolean(errors.description)}
        helperText={touched.description && errors.description ? errors.description : ''}
        multiline
        minRows={2}
      />
    </Stack>
  );
};

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
              <Box display="flex" alignItems="center" gap={1} px={3} pt={2} pb={1}>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {taskDataLoader.data?.name ?? 'Task'}
                </Typography>
                <IconMenuButton
                  items={[
                    {
                      label: 'Edit',
                      icon: mdiPencilOutline,
                      onClick: () => {
                        setEditTaskError(null);
                        setEditTaskOpen(true);
                      },
                    },
                    {
                      label: 'Share',
                      icon: mdiAccountPlusOutline,
                      onClick: () => {
                        setInviteError(null);
                        setInviteOpen(true);
                      },
                    },
                    {
                      label: 'Delete',
                      icon: mdiDeleteOutline,
                      onClick: () => {
                        handleDeleteTask();
                      },
                    },
                  ]}
                />
              </Box>

              <Box
                sx={{
                  flex: 1,
                  py: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  height: '100%',
                  overflow: 'auto',
                }}>
                <TaskCreateForm isReadOnly showAboutSection={false} autoSearchOnMount />
              </Box>
            </Box>
          </Formik>
        </LoadingGuard>
      </LoadingGuard>

      <EditDialog<TaskEditFormValues>
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
          element: <TaskEditForm />,
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
