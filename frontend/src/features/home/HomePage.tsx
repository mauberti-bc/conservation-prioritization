import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useMapContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
import { Sidebar } from './sidebar/Sidebar';

export type ACTIVE_VIEW = 'control-panel' | 'layers';

export const HomePage = () => {
  const { drawControlsRef } = useMapContext();
  const [activeView, setActiveView] = useState<ACTIVE_VIEW | null>('control-panel');

  const handleViewChange = (view: ACTIVE_VIEW | null) => {
    setActiveView(view);
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
      {/* NOTE: DISABLING LAYER HELPER, BUT THIS CONTROLS POPUPS TARGETTING HTML ELEMENTS WITH HELPFUL TIPS */}
      {/* <LayerHelper open={showTips} /> */}

      {/* Sidebar with fixed width, full height */}
      <Box
        sx={{
          flexShrink: 0,
          width: 780,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}>
        <Sidebar activeView={activeView} onViewChange={handleViewChange} />
      </Box>

      {/* Map fills remaining space and height */}
      <Box flex="1" display="flex" flexDirection="column" overflow="hidden" height="100%">
        {memoizedMap}
      </Box>
    </Stack>
  );
};
