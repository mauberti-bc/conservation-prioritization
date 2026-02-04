import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { ControlPanel } from '../control-panel/ControlPanel';
import { ACTIVE_VIEW } from '../HomePage';
import { LayerPanel } from '../layer-panel/LayerPanel';
import { SidebarNavigation } from './navigation/SidebarNavigation';

interface SidebarProps {
  activeView: ACTIVE_VIEW | null;
  onViewChange: (newView: ACTIVE_VIEW | null) => void;
}

export const Sidebar = ({ activeView, onViewChange }: SidebarProps) => {
  return (
    <Box display="flex" height="100%" zIndex={8}>
      {/* Sidebar navigation tabs */}
      <Paper elevation={1} sx={{ pl: 1, pt: 2, borderRadius: 0, minWidth: '220px' }}>
        <SidebarNavigation activeView={activeView} onViewChange={onViewChange} />
      </Paper>

      {/* Sidebar content */}
      <Box
        component={Paper}
        elevation={1}
        sx={{
          flexGrow: 1,
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
        }}>
        {activeView === 'new' && <ControlPanel />}
        {activeView === 'layers' && (
          <Box p={3}>
            <LayerPanel />
          </Box>
        )}
      </Box>
    </Box>
  );
};
