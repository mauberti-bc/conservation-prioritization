import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useMapContext } from 'hooks/useContext';
import { useSearchParams } from 'hooks/useSearchParams';
import { useEffect, useMemo } from 'react';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
import { Sidebar } from './sidebar/Sidebar';

export type ACTIVE_VIEW = 'new' | 'tasks' | 'projects' | 'layers';

export const HomePage = () => {
  const { searchParams, setSearchParams } = useSearchParams<{ v?: ACTIVE_VIEW }>();
  const { drawControlsRef } = useMapContext();

  useEffect(() => {
    if (!searchParams.get('v')) {
      setSearchParams(searchParams.set('v', 'new'));
    }
  }, [searchParams, setSearchParams]);

  const activeView = (searchParams.get('v') as ACTIVE_VIEW) ?? null;

  const handleViewChange = (view: ACTIVE_VIEW | null) => {
    searchParams.setOrDelete('v', view);
    setSearchParams(searchParams);
  };

  const memoizedMap = useMemo(() => {
    return (
      <>
        <MapContainer pmtilesUrls={['pmtiles://data/outputs/solution.pmtiles']} />
        <DrawControls ref={drawControlsRef} />
      </>
    );
  }, [drawControlsRef]);

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
