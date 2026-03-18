import Box from '@mui/material/Box';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { MapContainer } from '../../map/MapContainer';

interface TaskGridCardMapPreviewProps {
  task: GetTaskResponse;
}

export const TaskGridCardMapPreview = ({ task }: TaskGridCardMapPreviewProps) => {
  return (
    <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      <MapContainer
        pmtilesUrls={task.tileset_uri ? [task.tileset_uri] : []}
        useSharedContext={false}
        interactive={false}
        showNavigationControl={false}
        showBaseLayer
        pmtilesOpacity={0.75}
        waitForPmtiles={false}
      />
    </Box>
  );
};
