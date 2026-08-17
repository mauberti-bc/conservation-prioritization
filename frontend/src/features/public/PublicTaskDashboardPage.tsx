import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TASK_STATUS } from 'constants/status';
import { useConservationApi } from 'hooks/useConservationApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getTaskStatusLabel } from 'utils/task-status';
import { MapContainer } from 'features/home/map/MapContainer';

/**
 * Public view-only task dashboard for sharing results.
 */
export const PublicTaskDashboardPage = () => {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const conservationApi = useConservationApi();
  const taskDataLoader = useDataLoader(conservationApi.task.getTaskById);
  const dashboardDataLoader = useDataLoader(conservationApi.dashboard.getDashboardById);

  useEffect(() => {
    if (!dashboardId) {
      dashboardDataLoader.clearData();
      return;
    }

    void dashboardDataLoader.load(dashboardId);
  }, [dashboardDataLoader, dashboardId]);

  const primaryTaskId = dashboardDataLoader.data?.task_ids?.[0] ?? null;

  useEffect(() => {
    if (!primaryTaskId) {
      taskDataLoader.clearData();
      return;
    }

    void taskDataLoader.load(primaryTaskId);
  }, [primaryTaskId, taskDataLoader]);

  const pmtilesUrls = useMemo(() => {
    const resolvedUri = taskDataLoader.data?.tileset_uri ?? null;
    return resolvedUri ? [resolvedUri] : [];
  }, [taskDataLoader.data]);

  const statusLabel = useMemo(() => {
    const activeStatus = taskDataLoader.data?.status;

    if (!activeStatus) {
      return null;
    }

    if (activeStatus === TASK_STATUS.COMPLETED && !taskDataLoader.data?.tileset_uri) {
      return `${getTaskStatusLabel(activeStatus)} (map unavailable)`;
    }

    return getTaskStatusLabel(activeStatus);
  }, [taskDataLoader.data]);

  return (
    <Stack height="100%" width="100%" overflow="hidden">
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}>
        <Box>
          <Typography variant="h5">{taskDataLoader.data?.name ?? 'Task Dashboard'}</Typography>
          {taskDataLoader.data?.description && (
            <Typography variant="body2" color="text.secondary">
              {taskDataLoader.data.description}
            </Typography>
          )}
        </Box>
        {statusLabel && <Chip size="small" color="primary" label={statusLabel} />}
      </Box>

      <Box flex="1" position="relative" overflow="hidden">
        <MapContainer pmtilesUrls={pmtilesUrls} />
      </Box>
    </Stack>
  );
};
