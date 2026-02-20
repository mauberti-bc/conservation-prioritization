import { mdiCheck, mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { Formik } from 'formik';
import {
  CreateDraftTaskRequest,
  CreateTaskLayer,
  GetTaskResponse,
  OPTIMIZATION_VARIANT,
  SubmitTaskRequest,
} from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useMapContext } from 'hooks/useContext';
import { MutableRefObject, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskAdvancedSection } from './form/advanced/TaskAdvancedSection';
import { CreateTaskSubmitRefBinder } from './form/shared/CreateTaskSubmitRefBinder';
import { TaskCreateForm, TaskCreateFormValues } from './form/TaskCreateForm';
import { taskValidationSchema } from './TaskCreateYup';

const initialValues: TaskCreateFormValues = {
  resolution: 1000,
  description: null,
  resampling: 'mode',
  name: '',
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
  const navigate = useNavigate();

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

      const submitData: SubmitTaskRequest = {
        variant: values.variant,
        resolution: values.resolution,
        resampling: values.resampling,
        layers: mappedLayers,
        budget: mappedBudget,
        geometry: values.geometry.length
          ? values.geometry.map((geometry) => ({
              name: geometry.name,
              description: geometry.description,
              geojson: geometry.geojson,
            }))
          : undefined,
      };

      const createdDraftTask = await conservationApi.task.createTask(draftTaskData);
      const createdTask = await conservationApi.task.submitTask(createdDraftTask.task_id, submitData);

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
            <CreateTaskSubmitRefBinder
              submitRef={submitRef}
              onSubmittingChange={onSubmittingChange}
              isSubmitting={isSubmitting}
            />
            <Box
              sx={{
                flex: 1,
                py: 2,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                gap: 2,
                height: '100%',
                overflow: 'auto',
              }}>
              <Box px={3} display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                <Typography variant="h2" component="h2">
                  New Task
                </Typography>
                <IconButton
                  aria-label="Close new task"
                  onClick={() => {
                    navigate('/t/');
                  }}
                  edge="end"
                  size="small">
                  <Icon path={mdiClose} size={1} />
                </IconButton>
              </Box>
              <TaskCreateForm autoSearchOnMount showAdvancedSection={false} />
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
                <Box mx={3} mb={1}>
                  <TaskAdvancedSection />
                </Box>
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
              </Box>
            )}
          </Box>
        );
      }}
    </Formik>
  );
};
