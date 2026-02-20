import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { TASK_STATUS, TILE_STATUS } from 'constants/status';
import { useMapContext, useTaskContext } from 'hooks/useContext';
import { useMemo } from 'react';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
import { TaskViewSidebar } from './sidebar/TaskViewSidebar';
import { useTaskStatusWebSocket } from './task/status/useTaskStatusWebSocket';

/**
 * Task detail view for an existing submitted task.
 *
 * @returns {JSX.Element}
 */
export const ViewTaskPage = () => {
  const { drawControlsRef } = useMapContext();
  const { taskId, taskDataLoader, hoveredTilesetUri } = useTaskContext();
  const { data: taskStatus } = useTaskStatusWebSocket(taskId);

  const sidebarWidth = '42vw';
  const sidebarMinWidth = 320;

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

  const showStatusChip = useMemo(() => {
    const activeStatus = taskStatus?.status ?? taskDataLoader.data?.status;
    if (!activeStatus) {
      return false;
    }

    return activeStatus !== TASK_STATUS.DRAFT && activeStatus !== TASK_STATUS.COMPLETED;
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
              label="Processing"
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
        <TaskViewSidebar />
      </Box>
    </Box>
  );
};
