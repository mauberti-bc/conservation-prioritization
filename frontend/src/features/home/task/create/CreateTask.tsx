import { mdiCheck, mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { Formik } from 'formik';
import { CreateDraftTaskRequest, GetTaskResponse, OPTIMIZATION_MODE } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useMapContext } from 'hooks/useContext';
import { MutableRefObject, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildTaskSubmission } from 'utils/task-submission';
import { TaskAdvancedSection } from './form/advanced/TaskAdvancedSection';
import { CreateTaskSubmitRefBinder } from './form/shared/CreateTaskSubmitRefBinder';
import { DEFAULT_TASK_CREATE_NAME, TaskCreateForm, TaskCreateFormValues } from './form/TaskCreateForm';
import { taskValidationSchema } from './TaskCreateYup';

const initialValues: TaskCreateFormValues = {
  resolution: 240,
  description: null,
  resampling: 'mode',
  name: DEFAULT_TASK_CREATE_NAME,
  type: 'continuous_optimization',
  optimizationMode: OPTIMIZATION_MODE.INTERACTIVE,
  neighborPenaltyEnabled: false,
  neighborPenaltyStrength: 1,
  objectives: [],
  constraints: [],
  targetArea: [],
};

interface CreateTaskProps {
  onSubmitSuccess?: (task: GetTaskResponse) => void;
  onClose?: () => void;
  submitRef?: MutableRefObject<(() => void) | null>;
  hideInternalActions?: boolean;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

export const CreateTask = ({
  onSubmitSuccess,
  onClose,
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
      const draftTaskData: CreateDraftTaskRequest = {
        type: values.type,
        name: values.name,
        description: values.description ?? null,
        resolution: values.resolution,
        resampling: values.resampling,
      };

      const submitData = buildTaskSubmission(values);

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
            sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
            <CreateTaskSubmitRefBinder
              submitRef={submitRef}
              onSubmittingChange={onSubmittingChange}
              isSubmitting={isSubmitting}
            />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                px: 3,
                pt: 3,
                pb: 2,
                flex: '0 0 auto',
              }}>
              <Typography variant="h2" component="h2">
                New Task
              </Typography>
              <IconButton
                aria-label="Close new task"
                onClick={() => {
                  if (onClose) {
                    onClose();
                    return;
                  }

                  navigate('/t/');
                }}
                edge="end"
                size="small">
                <Icon path={mdiClose} size={1} />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 3, pt: 1, pb: 3 }}>
              <TaskCreateForm autoSearchOnMount />
            </Box>

            {!hideInternalActions && (
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  boxShadow: '0px -2px 25px 0px rgba(0,0,0,0.05)',
                  backgroundColor: 'white',
                  flex: '0 0 auto',
                }}>
                <Box mb={1}>
                  <TaskAdvancedSection />
                </Box>
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
            )}
          </Box>
        );
      }}
    </Formik>
  );
};
