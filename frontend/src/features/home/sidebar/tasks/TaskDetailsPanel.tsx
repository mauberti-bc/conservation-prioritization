import { mdiArrowLeft } from '@mdi/js';
import Icon from '@mdi/react';
import { LoadingButton } from '@mui/lab';
import { Chip, Divider, IconButton, Stack, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import { EditDialog } from 'components/dialog/EditDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useConservationApi } from 'hooks/useConservationApi';
import { useTaskContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { PublishDashboardForm, PublishDashboardFormValues } from './publish/PublishDashboardForm';

const publishDashboardSchema = Yup.object({
  name: Yup.string().required('Dashboard name is required').max(100, 'Name must be 100 characters or less'),
  access_scheme: Yup.mixed<'ANYONE_WITH_LINK' | 'MEMBERS_ONLY' | 'NOBODY'>()
    .oneOf(['ANYONE_WITH_LINK', 'MEMBERS_ONLY', 'NOBODY'])
    .required('Access scheme is required'),
});

/**
 * View-only task detail panel that renders the task form disabled.
 */
export const TaskDetailsPanel = () => {
  const conservationApi = useConservationApi();
  const { taskDataLoader, taskId, setFocusedTask } = useTaskContext();
  const navigate = useNavigate();
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const dashboardId = taskDataLoader.data?.dashboard_id ?? null;

  const task = taskDataLoader.data;

  const publishInitialValues = useMemo<PublishDashboardFormValues>(() => {
    return {
      name: task?.name ? `${task.name} Dashboard` : 'New Dashboard',
      access_scheme: 'MEMBERS_ONLY',
    };
  }, [task?.name]);

  const handlePublish = async (values: PublishDashboardFormValues) => {
    if (!task) {
      return;
    }

    if (dashboardId) {
      navigate(`/p/${dashboardId}`);
      return;
    }

    setIsPublishing(true);
    setPublishError(null);

    try {
      const response = await conservationApi.task.publishTaskDashboard(task.task_id, values);

      setPublishOpen(false);

      navigate(`/p/${response.dashboard_id}`);
    } catch (error) {
      console.error(error);
      setPublishError('Failed to publish dashboard.');
    } finally {
      setIsPublishing(false);
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
          <Typography color="textSecondary">Select a task to view its configuration.</Typography>
        </Box>
      }>
      <LoadingGuard
        isLoading={false}
        hasNoData={Boolean(taskDataLoader.error || !task)}
        hasNoDataFallback={
          <Box p={3}>
            <IconButton
              aria-label="Back to tasks"
              size="small"
              sx={{
                color: grey[700],
              }}
              onClick={() => {
                setFocusedTask(null);
              }}>
              <Icon path={mdiArrowLeft} size={1} color="rgba(97, 97, 97, 1)" />
            </IconButton>
            <Typography color="error">Failed to load task.</Typography>
          </Box>
        }>
        <Box sx={{ overflow: 'auto' }}>
          <Box display="flex" alignItems="center" gap={1} mb={2} p={2}>
            <IconButton
              aria-label="Back to tasks"
              size="small"
              sx={{
                color: grey[700],
              }}
              onClick={() => {
                setFocusedTask(null);
              }}>
              <Icon path={mdiArrowLeft} size={1} color="rgba(97, 97, 97, 1)" />
            </IconButton>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {task?.name ?? 'Task details'}
            </Typography>
            <LoadingButton
              variant="contained"
              loading={isPublishing}
              disabled={!task}
              onClick={() => {
                if (dashboardId) {
                  navigate(`/p/${dashboardId}`);
                  return;
                }

                setPublishOpen(true);
                setPublishError(null);
              }}>
              {dashboardId ? 'View Dashboard' : 'Publish'}
            </LoadingButton>
          </Box>

          <Box px={3} pb={3} display="flex" flexDirection="column" gap={3}>
            <Stack gap={1}>
              <Typography variant="overline" color="text.secondary">
                Summary
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {task?.status && <Chip size="small" label={task.status} color="primary" />}
                {task?.variant && <Chip size="small" label={`Variant: ${task.variant}`} />}
                {task?.resampling && <Chip size="small" label={`Resampling: ${task.resampling}`} />}
                {typeof task?.resolution === 'number' && <Chip size="small" label={`Resolution: ${task.resolution}`} />}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {task?.description || 'No description provided.'}
              </Typography>
            </Stack>

            <Divider />

            <Stack gap={2}>
              <Typography variant="overline" color="text.secondary">
                Layers
              </Typography>
              {(task?.layers ?? []).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No layers configured.
                </Typography>
              )}
              {(task?.layers ?? []).map((layer) => {
                const constraints = layer.constraints ?? [];
                return (
                  <Box
                    key={layer.task_layer_id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                      <Typography fontWeight={600}>{layer.layer_name}</Typography>
                      <Chip size="small" label={layer.mode} />
                      {typeof layer.importance === 'number' && (
                        <Chip size="small" label={`Importance: ${layer.importance}`} />
                      )}
                      {typeof layer.threshold === 'number' && (
                        <Chip size="small" label={`Threshold: ${layer.threshold}`} />
                      )}
                    </Stack>
                    {layer.description && (
                      <Typography variant="body2" color="text.secondary">
                        {layer.description}
                      </Typography>
                    )}
                    <Stack gap={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Constraints
                      </Typography>
                      {constraints.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          None
                        </Typography>
                      )}
                      {constraints.map((constraint) => {
                        const min = constraint.min ?? '–';
                        const max = constraint.max ?? '–';
                        return (
                          <Typography key={constraint.task_layer_constraint_id} variant="body2">
                            {constraint.type}: {min} to {max}
                          </Typography>
                        );
                      })}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Box>
      </LoadingGuard>

      <EditDialog<PublishDashboardFormValues>
        key={task?.task_id ?? 'publish-dashboard'}
        open={publishOpen}
        size="sm"
        dialogTitle="Publish dashboard"
        dialogSaveButtonLabel="Publish"
        dialogError={publishError ?? undefined}
        dialogLoading={isPublishing}
        onCancel={() => {
          setPublishOpen(false);
          setPublishError(null);
        }}
        onSave={handlePublish}
        component={{
          initialValues: publishInitialValues,
          validationSchema: publishDashboardSchema,
          element: <PublishDashboardForm />,
        }}
      />
    </LoadingGuard>
  );
};
