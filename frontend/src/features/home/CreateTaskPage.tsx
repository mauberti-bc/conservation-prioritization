import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { useMapContext } from 'hooks/useContext';
import { useNavigate } from 'react-router-dom';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
import { CreateTask } from './task/create/CreateTask';

/**
 * Full-page task creation view.
 *
 * @returns {JSX.Element}
 */
export const CreateTaskPage = () => {
  const navigate = useNavigate();
  const { drawControlsRef } = useMapContext();
  const sidebarWidth = '42vw';
  const sidebarMinWidth = 320;

  return (
    <Box position="relative" height="100%" overflow="hidden">
      <Box height="100%" display="flex" flexDirection="column" overflow="hidden">
        <MapContainer pmtilesUrls={[]} keepAliveKey="home-map" />
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
          minWidth: sidebarMinWidth,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 12,
        }}>
        <Box
          component={Paper}
          elevation={1}
          sx={{
            boxSizing: 'border-box',
            flex: 1,
            minWidth: 0,
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <CreateTask
              onSubmitSuccess={(task) => {
                navigate(`/t/${task.task_id}`);
              }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
