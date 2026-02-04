import { mdiArrowLeft, mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TaskCreateForm, TaskCreateFormValues } from 'features/home/task/create/form/TaskCreateForm';
import { Formik } from 'formik';
import { useTaskContext } from 'hooks/useContext';
import { useMemo } from 'react';
import { mapTaskResponseToCreateFormValues } from 'utils/task-mapping';

/**
 * View-only task detail panel that renders the task form disabled.
 */
export const TaskDetailsPanel = () => {
  const { taskDataLoader, taskId, setFocusedTask } = useTaskContext();

  const initialValues = useMemo<TaskCreateFormValues | null>(() => {
    if (!taskDataLoader.data) {
      return null;
    }
    return mapTaskResponseToCreateFormValues(taskDataLoader.data);
  }, [taskDataLoader.data]);

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
          <Typography color="textSecondary">Select a task to view its configuration.</Typography>
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
          onSubmit={() => undefined}
          validateOnChange={false}
          validateOnMount={false}
          validateOnBlur={false}>
          {() => {
            return (
              <Box sx={{ overflow: 'auto' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <IconButton
                    aria-label="Back to tasks"
                    size="small"
                    onClick={() => {
                      setFocusedTask(null);
                    }}>
                    <Icon path={mdiArrowLeft} size={1} />
                  </IconButton>
                  <IconButton
                    aria-label="Close task details"
                    size="small"
                    onClick={() => {
                      setFocusedTask(null);
                    }}>
                    <Icon path={mdiClose} size={1} />
                  </IconButton>
                </Box>
                <Box component="fieldset" disabled sx={{ border: 0, p: 0, m: 0 }}>
                  <TaskCreateForm isReadOnly />
                </Box>
              </Box>
            );
          }}
        </Formik>
      </LoadingGuard>
    </LoadingGuard>
  );
};
