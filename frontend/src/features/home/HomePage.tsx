import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { HomeQueryParams, QUERY_PARAM } from 'constants/query-params';
import { useMapContext, useTaskContext } from 'hooks/useContext';
import { useSearchParams } from 'hooks/useSearchParams';
import { useEffect, useMemo } from 'react';
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

  useEffect(() => {
    if (!searchParams.get(QUERY_PARAM.VIEW)) {
      setSearchParams(searchParams.set(QUERY_PARAM.VIEW, 'new'));
    }
  }, [searchParams, setSearchParams]);

  const activeView = (searchParams.get(QUERY_PARAM.VIEW) as ACTIVE_VIEW) ?? null;

  const handleViewChange = (view: ACTIVE_VIEW | null) => {
    searchParams.setOrDelete(QUERY_PARAM.VIEW, view);
    setSearchParams(searchParams);
  };

  const pmtilesUrls = useMemo(() => {
    const statusUri = taskStatus?.tile?.status === 'COMPLETED' && taskStatus.tile.uri ? taskStatus.tile.uri : null;
    const fallbackUri = taskDataLoader.data?.tileset_uri ?? null;
    const resolvedUri = statusUri ?? fallbackUri;

    return resolvedUri ? [resolvedUri] : [];
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
        <Sidebar activeView={activeView} onViewChange={handleViewChange} />
      </Box>

      {/* Map fills remaining space */}
      <Box flex="1" display="flex" flexDirection="column" overflow="hidden" height="100%">
        {memoizedMap}
      </Box>
    </Stack>
  );
};
