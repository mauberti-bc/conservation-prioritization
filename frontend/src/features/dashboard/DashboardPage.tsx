import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { TASK_STATUS, TILE_STATUS } from 'constants/status';
import { useConservationApi } from 'hooks/useConservationApi';
import { useAuthContext, useProjectContext, useSidebarUIContext, useTaskContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MapContainer } from 'features/home/map/MapContainer';
import { useTaskStatusWebSocket } from 'features/home/task/status/useTaskStatusWebSocket';
import { Sidebar } from 'features/home/sidebar/Sidebar';

/**
 * Authenticated dashboard view for published tasks.
 */
export const DashboardPage = () => {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const conservationApi = useConservationApi();
  const authContext = useAuthContext();
  const { taskId, taskDataLoader, tasksDataLoader, setFocusedTask, hoveredTilesetUri } = useTaskContext();
  const { projectsDataLoader } = useProjectContext();
  const { activeView, setActiveView } = useSidebarUIContext();
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
    if (!taskDataLoader.data) {
      return;
    }

    if (primaryTaskId && taskId !== primaryTaskId) {
      setFocusedTask(taskDataLoader.data);
    }
  }, [primaryTaskId, setFocusedTask, taskDataLoader.data, taskId]);

  useEffect(() => {
    if (!activeView) {
      setActiveView('tasks');
    }
  }, [activeView, setActiveView]);

  useEffect(() => {
    if (!authContext.auth.isAuthenticated) {
      return;
    }

    if (activeView === 'tasks') {
      void tasksDataLoader.load();
    }

    if (activeView === 'projects') {
      void projectsDataLoader.load();
    }
  }, [activeView, authContext.auth.isAuthenticated, projectsDataLoader, tasksDataLoader]);

  const { data: taskStatus } = useTaskStatusWebSocket(primaryTaskId);

  const pmtilesUrls = useMemo(() => {
    const statusUri =
      taskStatus?.tile?.status === TILE_STATUS.COMPLETED && taskStatus.tile.pmtiles_uri
        ? taskStatus.tile.pmtiles_uri
        : null;
    const fallbackUri = taskDataLoader.data?.tileset_uri ?? null;
    const resolvedUri = statusUri ?? fallbackUri;
    const baseUrls = resolvedUri ? [resolvedUri] : [];

    if (hoveredTilesetUri) {
      if (baseUrls.includes(hoveredTilesetUri)) {
        return baseUrls;
      }
      return [hoveredTilesetUri, ...baseUrls];
    }

    return baseUrls;
  }, [hoveredTilesetUri, taskStatus, taskDataLoader.data]);

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

  const sidebarWidth = activeView ? '50vw' : '180px';
  const sidebarMinWidth = activeView ? 360 : 180;

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
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          tasksDataLoader={tasksDataLoader}
          projectsDataLoader={projectsDataLoader}
          isAuthenticated={Boolean(authContext.auth.isAuthenticated)}
        />
      </Box>
    </Box>
  );
};
