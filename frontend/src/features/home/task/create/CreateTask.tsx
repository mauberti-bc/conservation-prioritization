import { mdiCheck } from '@mdi/js';
import Icon from '@mdi/react';
import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { Formik, useFormikContext } from 'formik';
import {
  CreateTaskLayer,
  CreateTaskRequest,
  GetTaskResponse,
  OPTIMIZATION_VARIANT,
} from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useMapContext, useTaskContext } from 'hooks/useContext';
import { MutableRefObject, useEffect, useState } from 'react';
import { TaskCreateForm, TaskCreateFormValues } from './form/TaskCreateForm';
import { taskValidationSchema } from './TaskCreateYup';

const initialValues: TaskCreateFormValues = {
  resolution: 1000,
  description: null,
  resampling: 'mode',
  name: 'Untitled Task',
  variant: OPTIMIZATION_VARIANT.STRICT,
  budget: null,
  layers: [],
  geometry: [],
};

interface CreateTaskProps {
  onSubmitSuccess?: (task: GetTaskResponse) => void;
  submitRef?: MutableRefObject<(() => void) | null>;
  hideInternalActions?: boolean;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

const SubmitRefBinder = ({
  submitRef,
  onSubmittingChange,
  isSubmitting,
}: {
  submitRef?: MutableRefObject<(() => void) | null>;
  onSubmittingChange?: (isSubmitting: boolean) => void;
  isSubmitting: boolean;
}) => {
  const { submitForm } = useFormikContext<TaskCreateFormValues>();

  useEffect(() => {
    if (!submitRef) {
      return;
    }
    submitRef.current = submitForm;
  }, [submitForm, submitRef]);

  useEffect(() => {
    if (!onSubmittingChange) {
      return;
    }
    onSubmittingChange(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

  return null;
};

export const CreateTask = ({
  onSubmitSuccess,
  submitRef,
  hideInternalActions = false,
  onSubmittingChange,
}: CreateTaskProps) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const { drawControlsRef, mapRef } = useMapContext();
  const { setFocusedTask, refreshTasks } = useTaskContext();

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

      // Create the task payload
      const taskData: CreateTaskRequest = {
        name: values.name,
        description: values.description ?? null,
        variant: values.variant, // You still need 'variant' here, so keep it
        resolution: values.resolution,
        resampling: values.resampling,
        layers: mappedLayers,
        geometry: values.geometry.length
          ? values.geometry.map((geometry) => ({
              name: geometry.name,
              description: geometry.description,
              geojson: geometry.geojson,
            }))
          : undefined,
      };

      // Call the API to create the task
      const createdTask = await conservationApi.task.createTask(taskData);
      setFocusedTask(createdTask);
      await refreshTasks();
      onSubmitSuccess?.(createdTask);

      // Success message
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
    <Formik
      initialValues={initialValues}
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
            <SubmitRefBinder
              submitRef={submitRef}
              onSubmittingChange={onSubmittingChange}
              isSubmitting={isSubmitting}
            />
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
              <TaskCreateForm />
            </Box>

            {/* Sticky footer */}
            {!hideInternalActions && (
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
                    Submit
                  </Button>
                </Box>
                <Typography variant="body2" textAlign="center" mt={1.5} color="textSecondary">
                  Your task will begin processing when you submit.
                </Typography>
              </Box>
            )}
          </Box>
        );
      }}
    </Formik>
  );
};
