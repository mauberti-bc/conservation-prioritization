import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { TASK_STATUS, TILE_STATUS } from 'constants/status';
import { AuthContext } from 'context/authContext';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { useMapContext, useProjectContext, useTaskContext } from 'hooks/useContext';
import { useContext, useEffect, useMemo } from 'react';
import { getTaskStatusLabel } from 'utils/task-status';
import { TasksLandingView } from './landing/TasksLandingView';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
import { Sidebar } from './sidebar/Sidebar';
import { useTaskStatusWebSocket } from './task/status/useTaskStatusWebSocket';

const defaultPagination: ApiPaginationRequestOptions = {
  page: 1,
  limit: 25,
  sort: 'created_at',
  order: 'desc',
};

export const HomePage = () => {
  const { drawControlsRef } = useMapContext();
  const { taskId, taskDataLoader, tasksDataLoader, hoveredTilesetUri } = useTaskContext();
  const { projectsDataLoader } = useProjectContext();
  const { data: taskStatus } = useTaskStatusWebSocket(taskId);
  const authContext = useContext(AuthContext);
  const isAuthenticated = Boolean(authContext?.auth?.isAuthenticated);

  const sidebarWidth = '42vw';
  const sidebarMinWidth = 320;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!taskId) {
      void tasksDataLoader.load(defaultPagination);
      void projectsDataLoader.load();
      return;
    }
  }, [isAuthenticated, taskId, tasksDataLoader, projectsDataLoader]);

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
      return `${getTaskStatusLabel(activeStatus)} (tiling: ${tileStatus})`;
    }

    return getTaskStatusLabel(activeStatus);
  }, [taskStatus, taskDataLoader.data]);

  const isSubmitting = useMemo(() => {
    const activeStatus = taskStatus?.status ?? taskDataLoader.data?.status;
    return activeStatus === TASK_STATUS.SUBMITTED;
  }, [taskStatus, taskDataLoader.data]);

  const memoizedMap = useMemo(() => {
    return (
      <>
        <MapContainer pmtilesUrls={pmtilesUrls} keepAliveKey="home-map" />
        <DrawControls ref={drawControlsRef} />
      </>
    );
  }, [drawControlsRef, pmtilesUrls]);

  if (!taskId) {
    return <TasksLandingView />;
  }

  return (
    <Box position="relative" height="100%" overflow="hidden">
      <Box height="100%" display="flex" flexDirection="column" overflow="hidden">
        {taskId && statusLabel && isSubmitting && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: `calc(${sidebarWidth} + ((100% - ${sidebarWidth}) / 2))`,
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}>
            <Chip
              size="medium"
              color="primary"
              label={statusLabel}
              sx={{
                fontWeight: 700,
                fontSize: '0.9rem',
                px: 1.5,
                py: 2,
                boxShadow: 3,
              }}
            />
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
        <Sidebar />
      </Box>
    </Box>
  );
};
