import { mdiArrowLeft } from '@mdi/js';
import Icon from '@mdi/react';
import { Chip, Divider, IconButton, Stack, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { grey } from '@mui/material/colors';
import { EditDialog } from 'components/dialog/EditDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useConservationApi } from 'hooks/useConservationApi';
import { useTaskContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTaskStatusLabel } from 'utils/task-status';
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
  const evidenceResolution = task?.latest_run?.input_snapshot?.evidence_resolution;
  const snapshotContracts = Object.values(task?.latest_run?.input_snapshot?.layer_contracts ?? {});
  const usesLegacyMapping = snapshotContracts.some(
    (contract) => contract?.compatibility_mode === 'legacy_noncanonical'
  );
  const evidenceLabel = evidenceResolution
    ? evidenceResolution.minimum === evidenceResolution.maximum
      ? `Evidence: ${evidenceResolution.minimum.toLocaleString()} m native`
      : `Evidence: ${evidenceResolution.minimum.toLocaleString()}–${evidenceResolution.maximum.toLocaleString()} m native`
    : 'Evidence: source-layer resolution';

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
            <Button
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
            </Button>
          </Box>

          <Box px={3} pb={3} display="flex" flexDirection="column" gap={3}>
            <Stack gap={1}>
              <Typography variant="overline" color="text.secondary">
                Summary
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {task?.status && <Chip size="small" label={getTaskStatusLabel(task.status)} color="primary" />}
                <Chip size="small" label={evidenceLabel} />
                {usesLegacyMapping && <Chip size="small" color="warning" label="Noncanonical legacy mapping" />}
                {typeof task?.resolution === 'number' && (
                  <Chip size="small" label={`Planning units: ${task.resolution} m`} />
                )}
                {task?.latest_run?.execution_method && (
                  <Chip size="small" label={`Method: ${task.latest_run.execution_method.replaceAll('_', ' ')}`} />
                )}
                {task?.latest_run?.solver_name && (
                  <Chip
                    size="small"
                    label={`Solver: ${task.latest_run.solver_name}${
                      task.latest_run.solver_version ? ` ${task.latest_run.solver_version}` : ''
                    }`}
                  />
                )}
                {typeof task?.latest_run?.planning_unit_count === 'number' && (
                  <Chip size="small" label={`${task.latest_run.planning_unit_count.toLocaleString()} units`} />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {task?.description || 'No description provided.'}
              </Typography>
            </Stack>

            <Divider />

            <Stack gap={2}>
              <Typography variant="overline" color="text.secondary">
                Objectives
              </Typography>
              {(task?.latest_run?.input_snapshot?.objectives ?? []).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No objectives configured.
                </Typography>
              )}
              {(task?.latest_run?.input_snapshot?.objectives ?? []).map((objective) => {
                return (
                  <Box
                    key={objective.layer}
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
                      <Typography fontWeight={600}>{objective.layer}</Typography>
                      <Chip size="small" label={objective.direction} />
                      <Chip size="small" label={`Importance: ${objective.importance}`} />
                    </Stack>
                  </Box>
                );
              })}
              <Typography variant="overline" color="text.secondary">
                Constraints
              </Typography>
              {(task?.latest_run?.input_snapshot?.constraints ?? []).map((constraint, index) => (
                <Typography key={`${constraint.type}:${constraint.layer}:${index}`} variant="body2">
                  {constraint.type}: {constraint.layer} ({constraint.min ?? '–'} to {constraint.max ?? '–'})
                </Typography>
              ))}
            </Stack>
          </Box>
        </Box>
      </LoadingGuard>

      <EditDialog<PublishDashboardFormValues>
        key={task?.task_id ?? 'publish-dashboard'}
        open={publishOpen}
        size="sm"
        dialogTitle="Publish Dashboard"
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
