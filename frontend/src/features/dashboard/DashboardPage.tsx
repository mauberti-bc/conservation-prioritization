import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { TASK_STATUS } from 'constants/status';
import { useConservationApi } from 'hooks/useConservationApi';
import { useApplicationEventsContext, useAuthContext, useTaskContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getTaskStatusLabel } from 'utils/task-status';
import { MapContainer } from 'features/home/map/MapContainer';
import { Sidebar } from 'features/home/sidebar/Sidebar';

/**
 * Authenticated dashboard view for published tasks.
 */
export const DashboardPage = () => {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const conservationApi = useConservationApi();
  const authContext = useAuthContext();
  const { taskRevisions, connectionEpoch, markTaskSeen } = useApplicationEventsContext();
  const { taskId, taskDataLoader, setFocusedTask, hoveredTilesetUri } = useTaskContext();
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardDataLoader = useDataLoader(conservationApi.dashboard.getDashboardById);

  useEffect(() => {
    if (!dashboardId) {
      dashboardDataLoader.clearData();
      return;
    }

    void dashboardDataLoader.load(dashboardId);
  }, [dashboardId, dashboardDataLoader]);

  useEffect(() => {
    if (!dashboardDataLoader.error) {
      return;
    }

    if (!authContext.auth.isAuthenticated) {
      navigate('/auth/login', { replace: true, state: { from: location.pathname } });
    }
  }, [authContext.auth.isAuthenticated, dashboardDataLoader.error, location.pathname, navigate]);

  const primaryTaskId = dashboardDataLoader.data?.task_ids?.[0] ?? null;

  useEffect(() => {
    if (!primaryTaskId) {
      return;
    }

    if (taskDataLoader.data?.task_id !== primaryTaskId) {
      void taskDataLoader.load(primaryTaskId);
    }
  }, [primaryTaskId, taskDataLoader]);

  useEffect(() => {
    if (!primaryTaskId || !taskRevisions[primaryTaskId] || !taskDataLoader.hasLoaded) {
      return;
    }

    void taskDataLoader.refresh(primaryTaskId);
    markTaskSeen(primaryTaskId);
    // Refresh only when the application event revision changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markTaskSeen, primaryTaskId, taskRevisions[primaryTaskId ?? '']]);

  useEffect(() => {
    if (!connectionEpoch || !primaryTaskId || !taskDataLoader.hasLoaded) {
      return;
    }
    void taskDataLoader.refresh(primaryTaskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionEpoch, primaryTaskId]);

  useEffect(() => {
    if (!taskDataLoader.data) {
      return;
    }

    if (primaryTaskId && taskId !== primaryTaskId) {
      setFocusedTask(taskDataLoader.data);
    }
  }, [primaryTaskId, setFocusedTask, taskDataLoader.data, taskId]);

  const pmtilesUrls = useMemo(() => {
    const resolvedUri = taskDataLoader.data?.tileset_uri ?? null;
    const baseUrls = resolvedUri ? [resolvedUri] : [];

    if (hoveredTilesetUri) {
      if (baseUrls.includes(hoveredTilesetUri)) {
        return baseUrls;
      }
      return [hoveredTilesetUri, ...baseUrls];
    }

    return baseUrls;
  }, [hoveredTilesetUri, taskDataLoader.data]);

  const statusLabel = useMemo(() => {
    const activeStatus = taskDataLoader.data?.status;

    if (!activeStatus) {
      return null;
    }

    if (activeStatus === TASK_STATUS.COMPLETED && !taskDataLoader.data?.tileset_uri) {
      return `${getTaskStatusLabel(activeStatus)} (building map)`;
    }

    return getTaskStatusLabel(activeStatus);
  }, [taskDataLoader.data]);

  const sidebarWidth = '50vw';
  const sidebarMinWidth = 360;

  return (
    <Box position="relative" height="100%" overflow="hidden">
      <Box height="100%" display="flex" flexDirection="column" overflow="hidden">
        {statusLabel && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}>
            <Chip size="small" color="primary" label={statusLabel} />
          </Box>
        )}
        <MapContainer pmtilesUrls={pmtilesUrls} />
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: sidebarWidth,
          maxWidth: sidebarWidth,
          minWidth: sidebarMinWidth,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 12,
        }}>
        <Sidebar />
      </Box>
    </Box>
  );
};
