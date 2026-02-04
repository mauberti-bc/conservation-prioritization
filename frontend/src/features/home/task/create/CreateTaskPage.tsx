import { mdiCheck } from '@mdi/js';
import Icon from '@mdi/react';
import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { Formik } from 'formik';
import { CreateTaskLayer, CreateTaskRequest } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useMapContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo, useState } from 'react';
import { taskValidationSchema } from './TaskCreateYup';
import { OPTIMIZATION_VARIANT } from 'hooks/interfaces/useTaskApi.interface';
import { TaskCreateForm, TaskCreateFormValues } from './form/TaskCreateForm';
import { TaskLayerOption } from './form/layer/task-layer.interface';

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

export const CreateTaskPage = () => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const { drawControlsRef, mapRef } = useMapContext();

  const availableLayersLoader = useDataLoader(async (search: string) => await conservationApi.layer.findLayers(search));

  const layerOptions: TaskLayerOption[] = useMemo(
    () =>
      availableLayersLoader.data?.layers.map((layer) => ({
        path: layer.path,
        name: layer.name,
        description: layer.description,
        group: layer.group,
      })) ?? [],
    [availableLayersLoader]
  );

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
      const { layers } = values; // Only destructure the 'layers' property

      // Map layers to TaskLayer objects
      const mappedLayers: CreateTaskLayer[] = layers.map((layer) => ({
        name: layer.name,
        description: null,
        mode: layer.mode,
        importance: layer.mode === 'flexible' ? layer.importance : undefined, // Only add importance if mode is flexible
        threshold: layer.mode === 'locked-in' || layer.mode === 'locked-out' ? layer.threshold : undefined, // Only add threshold if mode is locked-in or locked-out
        constraints: layer.constraints.map((constraint) => ({
          min: constraint.min ?? null, // Ensure null for undefined min
          max: constraint.max ?? null, // Ensure null for undefined max
          type: constraint.type,
        })),
      }));

      // Create the task payload
      const taskData: CreateTaskRequest = {
        name: values.name,
        description: values.name, // If description is the same as name, adjust as needed
        variant: values.variant, // You still need 'variant' here, so keep it
        resolution: values.resolution,
        resampling: values.resampling,
        layers: mappedLayers,
      };

      // Call the API to create the task
      await conservationApi.task.createTask(taskData);

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
              <TaskCreateForm layerOptions={layerOptions} />
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
                  Submit
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
  );
};
