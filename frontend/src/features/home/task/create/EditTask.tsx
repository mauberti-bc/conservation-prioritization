import { mdiCheck } from '@mdi/js';
import Icon from '@mdi/react';
import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { Formik } from 'formik';
import { CreateDraftTaskRequest } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useMapContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { buildTaskSubmission } from 'utils/task-submission';
import { mapTaskResponseToCreateFormValues } from 'utils/task-mapping';
import { taskValidationSchema } from './TaskCreateYup';
import { TaskCreateForm, TaskCreateFormValues } from './form/TaskCreateForm';

interface EditTaskProps {
  taskId?: string | null;
}

export const EditTask = ({ taskId: taskIdProp }: EditTaskProps) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { taskId: taskIdParam } = useParams<{ taskId?: string }>();
  const resolvedTaskId = taskIdProp ?? taskIdParam ?? null;
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const { drawControlsRef, mapRef } = useMapContext();

  const taskDataLoader = useDataLoader(conservationApi.task.getTaskById);

  useEffect(() => {
    if (resolvedTaskId) {
      taskDataLoader.load(resolvedTaskId);
    }
  }, [resolvedTaskId, taskDataLoader]);

  // Clean up drawn features when component unmounts
  useEffect(() => {
    const drawControls = drawControlsRef.current;
    const map = mapRef.current;
    return () => {
      if (drawControls && map) {
        drawControls.clearDrawing();
      }
    };
  }, [drawControlsRef, mapRef]);

  const initialValues = useMemo<TaskCreateFormValues | null>(() => {
    if (!taskDataLoader.data) {
      return null;
    }
    return mapTaskResponseToCreateFormValues(taskDataLoader.data);
  }, [taskDataLoader.data]);

  const handleSubmit = async (values: TaskCreateFormValues) => {
    setIsSubmitting(true);

    try {
      const draftTaskData: CreateDraftTaskRequest = {
        type: values.type,
        name: values.name,
        description: values.description ?? null,
        resolution: values.resolution,
        resampling: values.resampling,
      };

      const submitData = buildTaskSubmission(values);

      const createdDraftTask = await conservationApi.task.createTask(draftTaskData);
      await conservationApi.task.submitTask(createdDraftTask.task_id, submitData);

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (
          <Stack flexDirection="row" gap={1}>
            <Icon path={mdiCheck} size={1} />
            Successfully started task
          </Stack>
        ),
      });
    } catch (error) {
      console.error(error);
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Failed to create task',
      });
    } finally {
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  return (
    <LoadingGuard
      isLoading={Boolean(resolvedTaskId) && (taskDataLoader.isLoading || !taskDataLoader.hasLoaded)}
      isLoadingFallback={
        <Box p={3}>
          <Typography>Loading task...</Typography>
        </Box>
      }
      hasNoData={!resolvedTaskId}
      hasNoDataFallback={
        <Box p={3}>
          <Typography color="error">Missing task ID.</Typography>
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
                sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    px: 3,
                    pt: 3,
                    pb: 3,
                  }}>
                  <Box pb={2}>
                    <Typography variant="body2" color="textSecondary">
                      This will create a new task based on the selected configuration.
                    </Typography>
                  </Box>
                  <TaskCreateForm />
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
                    variant="contained"
                    loading={isSubmitting}
                    type="submit"
                    color="primary"
                    sx={{ flex: 1, py: 2 }}
                    fullWidth>
                    Create Copy
                  </Button>
                </Box>
              </Box>
            );
          }}
        </Formik>
      </LoadingGuard>
    </LoadingGuard>
  );
};
