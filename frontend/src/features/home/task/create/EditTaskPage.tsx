import { mdiCheck } from '@mdi/js';
import Icon from '@mdi/react';
import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { Formik } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { CreateTaskLayer, CreateTaskRequest } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useMapContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { mapTaskResponseToCreateFormValues } from 'utils/task-mapping';
import { taskValidationSchema } from './TaskCreateYup';
import { TaskCreateForm, TaskCreateFormValues } from './form/TaskCreateForm';

export const EditTaskPage = () => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { taskId } = useParams<{ taskId?: string }>();
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const { drawControlsRef, mapRef } = useMapContext();

  const taskDataLoader = useDataLoader(conservationApi.task.getTaskById);

  useEffect(() => {
    if (taskId) {
      taskDataLoader.load(taskId);
    }
  }, [taskId, taskDataLoader]);

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
      const mappedLayers: CreateTaskLayer[] = values.layers.map((layer) => ({
        layer_name: layer.name,
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

      const taskData: CreateTaskRequest = {
        name: values.name,
        description: values.name,
        variant: values.variant,
        resolution: values.resolution,
        resampling: values.resampling,
        layers: mappedLayers,
      };

      await conservationApi.task.createTask(taskData);

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
      isLoading={Boolean(taskId) && (taskDataLoader.isLoading || !taskDataLoader.hasLoaded)}
      isLoadingFallback={
        <Box p={3}>
          <Typography>Loading task...</Typography>
        </Box>
      }
      hasNoData={!taskId}
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
                sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <Box
                  sx={{
                    flex: 1,
                    pb: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    gap: 2,
                    height: '100%',
                    overflow: 'auto',
                  }}>
                  <Box px={3} pt={2}>
                    <Typography variant="body2" color="textSecondary">
                      This will create a new task based on the selected configuration.
                    </Typography>
                  </Box>
                  <TaskCreateForm />
                </Box>

                {/* Sticky footer */}
                <Box
                  mr={0.5}
                  py={2}
                  sx={{
                    boxShadow: '0px -2px 25px 0px rgba(0,0,0,0.05)',
                    position: 'sticky',
                    bottom: 0,
                    backgroundColor: 'white',
                  }}>
                  {/* Submit Button */}
                  <Box mx={3}>
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
                  <Typography variant="body2" textAlign="center" mt={1.5} color="textSecondary">
                    Your task will begin processing when you submit.
                  </Typography>
                </Box>
              </Box>
            );
          }}
        </Formik>
      </LoadingGuard>
    </LoadingGuard>
  );
};
