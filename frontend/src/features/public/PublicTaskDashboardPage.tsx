import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TASK_STATUS, TILE_STATUS } from 'constants/status';
import { useConservationApi } from 'hooks/useConservationApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer } from 'features/home/map/MapContainer';
import { useTaskStatusWebSocket } from 'features/home/task/status/useTaskStatusWebSocket';

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
  const { data: taskStatus } = useTaskStatusWebSocket(primaryTaskId);

  useEffect(() => {
    if (!primaryTaskId) {
      taskDataLoader.clearData();
      return;
    }

    void taskDataLoader.load(primaryTaskId);
  }, [primaryTaskId, taskDataLoader]);

  const pmtilesUrls = useMemo(() => {
    const statusUri =
      taskStatus?.tile?.status === TILE_STATUS.COMPLETED && taskStatus.tile.pmtiles_uri
        ? taskStatus.tile.pmtiles_uri
        : null;
    const fallbackUri = taskDataLoader.data?.tileset_uri ?? null;
    const resolvedUri = statusUri ?? fallbackUri;

    return resolvedUri ? [resolvedUri] : [];
  }, [taskStatus, taskDataLoader.data]);

  const statusLabel = useMemo(() => {
    const activeStatus = taskStatus?.status ?? taskDataLoader.data?.status;
    const tileStatus = taskStatus?.tile?.status ?? null;

    if (!activeStatus) {
      return null;
    }

    if (activeStatus === TASK_STATUS.COMPLETED && tileStatus && tileStatus !== TILE_STATUS.COMPLETED) {
      return `${activeStatus} (tiling: ${tileStatus})`;
    }

    return activeStatus;
  }, [taskStatus, taskDataLoader.data]);

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
