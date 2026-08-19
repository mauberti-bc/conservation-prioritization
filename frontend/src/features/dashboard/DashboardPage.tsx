import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { TASK_STATUS } from 'constants/status';
import { MapContainer } from 'features/home/map/MapContainer';
import { FloatingSidebarContainer } from 'features/home/sidebar/FloatingSidebarContainer';
import { Sidebar } from 'features/home/sidebar/Sidebar';
import { SIDEBAR_FLOAT_MARGIN_PX } from 'features/home/sidebar/sidebar-layout.constants';
import { useConservationApi } from 'hooks/useConservationApi';
import { useApplicationEventsContext, useAuthContext, useTaskContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getTaskStatusLabel } from 'utils/task-status';

/**
 * Authenticated dashboard view for published tasks.
 */
export const DashboardPage = () => {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const conservationApi = useConservationApi();
  const authContext = useAuthContext();
  const { taskRevisions, taskStatuses, connectionEpoch, markTaskSeen } = useApplicationEventsContext();
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
    const activeStatus = primaryTaskId ? (taskStatuses[primaryTaskId] ?? taskDataLoader.data?.status) : null;

    if (!activeStatus) {
      return null;
    }

    if (activeStatus === TASK_STATUS.COMPLETED && !taskDataLoader.data?.tileset_uri) {
      return `${getTaskStatusLabel(activeStatus)} (building map)`;
    }

    return getTaskStatusLabel(activeStatus);
  }, [primaryTaskId, taskDataLoader.data, taskStatuses]);

  const sidebarWidth = { xs: `calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px)`, md: '50vw' };
  const sidebarMaxWidth = { xs: `calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px)`, md: 720 };
  const statusChipLeft = `calc((100% + (${SIDEBAR_FLOAT_MARGIN_PX}px + min(50vw, 720px))) / 2)`;

  return (
    <Box position="relative" height="100%" overflow="hidden">
      <Box height="100%" display="flex" flexDirection="column" overflow="hidden">
        {statusLabel && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: { xs: '50%', md: statusChipLeft },
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}>
            <Chip size="small" color="primary" label={statusLabel} />
          </Box>
        )}
        <MapContainer pmtilesUrls={pmtilesUrls} pmtilesLegendTaskType={taskDataLoader.data?.type ?? null} />
      </Box>

      <FloatingSidebarContainer width={sidebarWidth} maxWidth={sidebarMaxWidth}>
        <Sidebar />
      </FloatingSidebarContainer>
    </Box>
  );
};
