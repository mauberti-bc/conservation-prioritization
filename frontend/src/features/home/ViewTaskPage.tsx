import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { TASK_STATUS } from 'constants/status';
import { useApplicationEventsContext, useMapContext, useTaskContext } from 'hooks/useContext';
import { useEffect, useMemo, useState } from 'react';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
import { FloatingSidebarContainer } from './sidebar/FloatingSidebarContainer';
import { SIDEBAR_FLOAT_MARGIN_PX, SIDEBAR_FLOAT_WIDTH_PX } from './sidebar/sidebar-layout.constants';
import { TaskViewPanel } from './task/view/panel/TaskViewPanel';

/**
 * Task detail view for an existing submitted task.
 *
 * @returns {JSX.Element}
 */
export const ViewTaskPage = () => {
  const { drawControlsRef } = useMapContext();
  const { taskId, taskDataLoader, hoveredTilesetUri } = useTaskContext();
  const { taskRevisions, taskStatuses, connectionEpoch, markTaskSeen } = useApplicationEventsContext();
  const [isResettingPmtiles, setIsResettingPmtiles] = useState(false);
  const sidebarWidth = { xs: `calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px)`, md: SIDEBAR_FLOAT_WIDTH_PX };
  const sidebarMaxWidth = { xs: `calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px)`, md: SIDEBAR_FLOAT_WIDTH_PX };
  const statusChipLeft = `calc((100% + ${SIDEBAR_FLOAT_MARGIN_PX + SIDEBAR_FLOAT_WIDTH_PX}px) / 2)`;
  const activeTaskData = useMemo(() => {
    if (!taskDataLoader.data || taskDataLoader.data.task_id !== taskId) {
      return null;
    }

    return {
      ...taskDataLoader.data,
      status: taskStatuses[taskId] ?? taskDataLoader.data.status,
    };
  }, [taskDataLoader.data, taskId, taskStatuses]);

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
              left: { xs: '50%', md: statusChipLeft },
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
        <MapContainer
          pmtilesUrls={isResettingPmtiles ? [] : pmtilesUrls}
          boundsRefreshKey={taskId}
          pmtilesLegendTaskType={activeTaskData?.type ?? null}
        />
        <DrawControls ref={drawControlsRef} />
      </Box>

      <FloatingSidebarContainer width={sidebarWidth} maxWidth={sidebarMaxWidth}>
        <TaskViewPanel />
      </FloatingSidebarContainer>
    </Box>
  );
};
