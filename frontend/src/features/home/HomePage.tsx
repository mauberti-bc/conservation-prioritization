import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { HomeQueryParams, QUERY_PARAM } from 'constants/query-params';
import { TASK_STATUS, TILE_STATUS } from 'constants/status';
import { AuthContext } from 'context/authContext';
import { useConservationApi } from 'hooks/useConservationApi';
import { useMapContext, useTaskContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useSearchParams } from 'hooks/useSearchParams';
import { useContext, useEffect, useMemo } from 'react';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
import { Sidebar } from './sidebar/Sidebar';
import { useTaskStatusWebSocket } from './task/status/useTaskStatusWebSocket';

export type ACTIVE_VIEW = 'new' | 'tasks' | 'projects' | 'layers';

export const HomePage = () => {
  const { searchParams, setSearchParams } = useSearchParams<HomeQueryParams>();
  const { drawControlsRef } = useMapContext();
  const { taskId, taskDataLoader } = useTaskContext();
  const { data: taskStatus } = useTaskStatusWebSocket(taskId);
  const authContext = useContext(AuthContext);
  const isAuthenticated = Boolean(authContext?.auth?.isAuthenticated);
  const conservationApi = useConservationApi();
  const tasksDataLoader = useDataLoader(conservationApi.task.getAllTasks);
  const projectsDataLoader = useDataLoader(conservationApi.project.getAllProjects);

  useEffect(() => {
    if (!searchParams.get(QUERY_PARAM.VIEW)) {
      setSearchParams(searchParams.set(QUERY_PARAM.VIEW, 'new'));
    }
  }, [searchParams, setSearchParams]);

  const activeView = (searchParams.get(QUERY_PARAM.VIEW) as ACTIVE_VIEW) ?? null;

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

  const handleViewChange = (view: ACTIVE_VIEW | null) => {
    searchParams.setOrDelete(QUERY_PARAM.VIEW, view);
    setSearchParams(searchParams);
  };

  const pmtilesUrls = useMemo(() => {
    const statusUri =
      taskStatus?.tile?.status === TILE_STATUS.COMPLETED && taskStatus.tile.uri ? taskStatus.tile.uri : null;
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

  const memoizedMap = useMemo(() => {
    return (
      <>
        <MapContainer pmtilesUrls={pmtilesUrls} />
        <DrawControls ref={drawControlsRef} />
      </>
    );
  }, [drawControlsRef, pmtilesUrls]);

  return (
    <Stack flex="1" direction="row" m={0} p={0} overflow="hidden" height="100%">
      {/* Sidebar with fixed width, full height */}
      <Box
        sx={{
          flexShrink: 0,
          width: '70vw',
          maxWidth: '800px',
          minWidth: '700px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}>
        <Sidebar
          activeView={activeView}
          onViewChange={handleViewChange}
          tasksDataLoader={tasksDataLoader}
          projectsDataLoader={projectsDataLoader}
          isAuthenticated={isAuthenticated}
        />
      </Box>

      {/* Map fills remaining space */}
      <Box flex="1" display="flex" flexDirection="column" overflow="hidden" height="100%" position="relative">
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
    </Stack>
  );
};
