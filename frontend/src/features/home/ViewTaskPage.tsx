import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { TASK_STATUS, TILE_STATUS } from 'constants/status';
import { useMapContext, useTaskContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
import { useTaskStatusWebSocket } from './task/status/useTaskStatusWebSocket';
import { getTaskViewSidebarWidth } from './task/view/sidebar/task-view-sidebar.constants';
import { TaskViewSidebar } from './task/view/sidebar/TaskViewSidebar';

/**
 * Task detail view for an existing submitted task.
 *
 * @returns {JSX.Element}
 */
export const ViewTaskPage = () => {
  const { drawControlsRef } = useMapContext();
  const { taskId, taskDataLoader, hoveredTilesetUri } = useTaskContext();
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const sidebarWidthPx = getTaskViewSidebarWidth(isPreviewOpen);
  const sidebarWidth = `${sidebarWidthPx}px`;

  const sidebarMinWidth = 320;
  const shouldSubscribeToTaskStatus = useMemo(() => {
    if (!taskId || !taskDataLoader.hasLoaded) {
      return false;
    }

    return !taskDataLoader.data?.tileset_uri;
  }, [taskDataLoader.data?.tileset_uri, taskDataLoader.hasLoaded, taskId]);
  const { data: taskStatus } = useTaskStatusWebSocket(shouldSubscribeToTaskStatus ? taskId : null);
  const activeTaskStatus = useMemo(() => {
    if (!taskStatus || taskStatus.task_id !== taskId) {
      return null;
    }

    return taskStatus;
  }, [taskId, taskStatus]);

  const resolvedPmtilesUri = useMemo(() => {
    if (activeTaskStatus?.tile?.status === TILE_STATUS.COMPLETED && activeTaskStatus.tile.pmtiles_uri) {
      return activeTaskStatus.tile.pmtiles_uri;
    }

    return taskDataLoader.data?.tileset_uri ?? null;
  }, [activeTaskStatus, taskDataLoader.data]);

  const pmtilesUrls = useMemo(() => {
    const baseUrls = resolvedPmtilesUri ? [resolvedPmtilesUri] : [];

    if (hoveredTilesetUri) {
      if (baseUrls.includes(hoveredTilesetUri)) {
        return baseUrls;
      }
      return [hoveredTilesetUri, ...baseUrls];
    }

    return baseUrls;
  }, [hoveredTilesetUri, resolvedPmtilesUri]);

  const showStatusChip = useMemo(() => {
    const activeStatus = activeTaskStatus?.status ?? taskDataLoader.data?.status;
    if (!activeStatus) {
      return false;
    }

    return activeStatus !== TASK_STATUS.DRAFT && activeStatus !== TASK_STATUS.COMPLETED;
  }, [activeTaskStatus, taskDataLoader.data]);

  return (
    <Box position="relative" height="100%" overflow="hidden">
      <Box height="100%" display="flex" flexDirection="column" overflow="hidden">
        {taskId && showStatusChip && (
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
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  Processing
                  <CircularProgress size={14} color="inherit" thickness={8} />
                </Box>
              }
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
        <MapContainer pmtilesUrls={pmtilesUrls} keepAliveKey="home-map" />
        <DrawControls ref={drawControlsRef} />
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: sidebarWidth,
          maxWidth: sidebarWidth,
          minWidth: `${sidebarMinWidth}px`,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 12,
        }}>
        <TaskViewSidebar
          isPreviewOpen={isPreviewOpen}
          onTogglePreview={() => {
            setIsPreviewOpen((prev) => !prev);
          }}
        />
      </Box>
    </Box>
  );
};
