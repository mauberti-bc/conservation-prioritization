import Box from '@mui/material/Box';
import { useMapContext } from 'hooks/useContext';
import { useNavigate } from 'react-router-dom';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
import { FloatingSidebarContainer } from './sidebar/FloatingSidebarContainer';
import { SIDEBAR_FLOAT_MARGIN_PX } from './sidebar/sidebar-layout.constants';
import { CreateTask } from './task/create/CreateTask';

/**
 * Full-page task creation view.
 *
 * @returns {JSX.Element}
 */
export const CreateTaskPage = () => {
  const navigate = useNavigate();
  const { drawControlsRef } = useMapContext();
  const sidebarWidth = { xs: `calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px)`, md: '42vw' };
  const sidebarMaxWidth = { xs: `calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px)`, md: 560 };

  return (
    <Box position="relative" height="100%" overflow="hidden">
      <Box height="100%" display="flex" flexDirection="column" overflow="hidden">
        <MapContainer pmtilesUrls={[]} />
        <DrawControls ref={drawControlsRef} />
      </Box>

      <FloatingSidebarContainer width={sidebarWidth} maxWidth={sidebarMaxWidth}>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <CreateTask
            onSubmitSuccess={(task) => {
              navigate(`/t/${task.task_id}`);
            }}
          />
        </Box>
      </FloatingSidebarContainer>
    </Box>
  );
};
