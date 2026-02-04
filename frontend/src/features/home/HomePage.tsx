import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { TASK_STATUS, TILE_STATUS } from 'constants/status';
import { AuthContext } from 'context/authContext';
import { useMapContext, useProjectContext, useSidebarUIContext, useTaskContext } from 'hooks/useContext';
import { useContext, useEffect, useMemo } from 'react';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
import { Sidebar } from './sidebar/Sidebar';
import { useTaskStatusWebSocket } from './task/status/useTaskStatusWebSocket';

export const HomePage = () => {
  const { drawControlsRef } = useMapContext();
  const { taskId, taskDataLoader, tasksDataLoader, hoveredTilesetUri } = useTaskContext();
  const { projectsDataLoader } = useProjectContext();
  const { activeView, setActiveView } = useSidebarUIContext();
  const { data: taskStatus } = useTaskStatusWebSocket(taskId);
  const authContext = useContext(AuthContext);
  const isAuthenticated = Boolean(authContext?.auth?.isAuthenticated);

  const sidebarWidth = activeView ? '50vw' : '180px';
  const sidebarMinWidth = activeView ? 360 : 180;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (activeView === 'tasks') {
      void tasksDataLoader.load();
    }

    if (activeView === 'projects') {
      void projectsDataLoader.load();
    }
  }, [activeView, isAuthenticated, tasksDataLoader, projectsDataLoader]);

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
  }, [taskStatus, taskDataLoader.data, hoveredTilesetUri]);

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

  const memoizedMap = useMemo(() => {
    return (
      <>
        <MapContainer pmtilesUrls={pmtilesUrls} keepAliveKey="home-map" />
        <DrawControls ref={drawControlsRef} />
      </>
    );
  }, [drawControlsRef, pmtilesUrls]);

  return (
    <Box position="relative" height="100%" overflow="hidden">
      <Box height="100%" display="flex" flexDirection="column" overflow="hidden">
        {taskId && statusLabel && (
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
        {memoizedMap}
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
          isAuthenticated={isAuthenticated}
        />
      </Box>
    </Box>
  );
};
