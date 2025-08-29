import { mdiLayersTripleOutline, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { ControlPanel } from '../control-panel/ControlPanel';
import { ACTIVE_VIEW } from '../HomePage';
import { LayerPanel } from '../layer-panel/LayerPanel';

interface SidebarProps {
  activeView: ACTIVE_VIEW | null;
  onViewChange: (newView: ACTIVE_VIEW | null) => void;
}

export const Sidebar = ({ activeView, onViewChange }: SidebarProps) => {
  const handleViewChange = (_event: React.MouseEvent<HTMLElement>, newView: ACTIVE_VIEW | null) => {
    onViewChange(newView);
  };

  return (
    <Box display="flex" height="100%" zIndex={8}>
      {/* Toggle buttons */}
      <Stack
        component={Paper}
        elevation={1}
        bgcolor={grey[100]}
        sx={{ borderRadius: 0 }}
        alignItems="center"
        px={2}
        py={3}
        spacing={2}>
        <ToggleButtonGroup
          orientation="vertical"
          value={activeView}
          exclusive
          color="primary"
          onChange={handleViewChange}
          sx={{
            gap: 2,
            borderRadius: '4px',
            '& .MuiToggleButton-root': {
              p: 1.5,
              borderRadius: '4px',
              minWidth: 0,
              '&:hover:not(.Mui-selected)': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
            },
          }}>
          <ToggleButton value="control-panel" aria-label="Control Panel">
            <Icon path={mdiPlus} size={1.2} />
          </ToggleButton>
          <ToggleButton value="layers" aria-label="Layers">
            <Icon path={mdiLayersTripleOutline} size={1.2} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/*Sidebar content */}
      <Box
        component={Paper}
        elevation={1}
        sx={{
          flexGrow: 1,
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
        }}>
        {activeView === 'control-panel' && <ControlPanel />}
        {activeView === 'layers' && (
          <Box p={3}>
            <LayerPanel />
          </Box>
        )}
      </Box>
    </Box>
  );
};
