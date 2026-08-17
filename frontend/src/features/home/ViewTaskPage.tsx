import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { TASK_STATUS } from 'constants/status';
import { useApplicationEventsContext, useMapContext, useTaskContext } from 'hooks/useContext';
import { useEffect, useMemo, useState } from 'react';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
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
  const { taskRevisions, connectionEpoch, markTaskSeen } = useApplicationEventsContext();
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [isResettingPmtiles, setIsResettingPmtiles] = useState(false);
  const sidebarWidthPx = getTaskViewSidebarWidth(isPreviewOpen);
  const sidebarWidth = `${sidebarWidthPx}px`;

  const sidebarMinWidth = 320;
  const activeTaskData = useMemo(() => {
    if (!taskDataLoader.data || taskDataLoader.data.task_id !== taskId) {
      return null;
    }

    return taskDataLoader.data;
  }, [taskDataLoader.data, taskId]);

  useEffect(() => {
    const revision = taskRevisions[taskId];
    if (!revision || !taskDataLoader.hasLoaded) {
      return;
    }
    void taskDataLoader.refresh(taskId);
    markTaskSeen(taskId);
    // The loader is intentionally refreshed only when the authoritative revision changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markTaskSeen, taskId, taskRevisions[taskId]]);

  useEffect(() => {
    if (!connectionEpoch || !taskDataLoader.hasLoaded) {
      return;
    }
    void taskDataLoader.refresh(taskId);
    // Reconnect recovery is authoritative REST refetch, not event replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionEpoch, taskId]);

  const referenceDecisionUri = useMemo(() => {
    const decision = activeTaskData?.latest_run?.artifacts?.find(
      (artifact) => artifact.type === 'pmtiles' && artifact.status === 'ready'
    );
    return decision?.uri ?? null;
  }, [activeTaskData]);

  const resolvedPmtilesUri = referenceDecisionUri ?? activeTaskData?.tileset_uri ?? null;

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

  useEffect(() => {
    setIsResettingPmtiles(true);
    const resetTimer = window.setTimeout(() => {
      setIsResettingPmtiles(false);
    }, 0);

    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [resolvedPmtilesUri, taskId]);

  const showStatusChip = useMemo(() => {
    const activeStatus = activeTaskData?.status;
    const hasPmtilesUri = Boolean(activeTaskData?.tileset_uri);
    if (!activeStatus) {
      return false;
    }

    if (activeStatus === TASK_STATUS.DRAFT) {
      return false;
    }

    if (activeStatus === TASK_STATUS.COMPLETED) {
      return !hasPmtilesUri;
    }

    return true;
  }, [activeTaskData]);

  const statusChipLabel = useMemo(() => {
    const activeStatus = activeTaskData?.status;
    const hasPmtilesUri = Boolean(activeTaskData?.tileset_uri);

    if (activeStatus === TASK_STATUS.COMPLETED && !hasPmtilesUri) {
      return 'Building map';
    }

    const stage = activeTaskData?.latest_run?.stage;
    if (stage === 'counting') {
      return 'Counting planning units';
    }
    if (stage === 'preparing') {
      return 'Preparing data';
    }
    if (stage === 'compiling') {
      return 'Compiling model';
    }
    if (stage === 'admitting') {
      return 'Checking capacity';
    }
    if (stage === 'solving') {
      return 'Optimizing';
    }
    if (stage === 'materializing') {
      return 'Saving result';
    }
    if (stage === 'exporting') {
      return 'Building export';
    }
    if (stage === 'publishing') {
      return 'Building map';
    }

    return 'Processing';
  }, [activeTaskData]);

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
                  {statusChipLabel}
                  <CircularProgress size={12} color="inherit" thickness={7} />
                </Box>
              }
              sx={{
                fontWeight: 700,
                fontSize: '1rem',
                px: 2,
                py: 2.5,
                boxShadow: 3,
              }}
            />
          </Box>
        )}
        <MapContainer pmtilesUrls={isResettingPmtiles ? [] : pmtilesUrls} boundsRefreshKey={taskId} />
        {resolvedPmtilesUri && (
          <Box
            sx={{
              position: 'absolute',
              right: 16,
              bottom: 32,
              zIndex: 10,
              bgcolor: 'background.paper',
              borderRadius: 1,
              boxShadow: 3,
              p: 1.5,
              minWidth: 230,
            }}>
            <Typography variant="body2">Reference solution</Typography>
          </Box>
        )}
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
