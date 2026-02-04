import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { DataLoader } from 'hooks/useDataLoader';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { CreateTaskPage } from '../task/create/CreateTaskPage';
import { ACTIVE_VIEW } from '../HomePage';
import { LayerPanel } from '../layer-panel/LayerPanel';
import { SidebarNavigation } from './navigation/SidebarNavigation';
import { ProjectList } from './projects/ProjectList';
import { TaskList } from './tasks/TaskList';

interface SidebarProps {
  activeView: ACTIVE_VIEW | null;
  onViewChange: (newView: ACTIVE_VIEW | null) => void;
  tasksDataLoader: DataLoader<[], GetTaskResponse[], unknown>;
  projectsDataLoader: DataLoader<[], GetProjectResponse[], unknown>;
  isAuthenticated: boolean;
}

export const Sidebar = ({
  activeView,
  onViewChange,
  tasksDataLoader,
  projectsDataLoader,
  isAuthenticated,
}: SidebarProps) => {
  return (
    <Box display="flex" height="100%" zIndex={8} width="100%">
      {/* Sidebar navigation tabs */}
      <Paper
        elevation={1}
        sx={{
          pl: 1,
          pt: 2,
          borderRadius: 0,
          flexShrink: 0,
        }}>
        <SidebarNavigation activeView={activeView} onViewChange={onViewChange} />
      </Paper>

      {/* Sidebar content */}
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
        {activeView === 'new' && <CreateTaskPage />}
        {activeView === 'tasks' && (
          <Box p={3} sx={{ overflow: 'auto' }}>
            <TaskList tasks={tasksDataLoader.data ?? []} isLoading={tasksDataLoader.isLoading} />
          </Box>
        )}
        {activeView === 'projects' && (
          <Box p={3} sx={{ overflow: 'auto' }}>
            <ProjectList projects={projectsDataLoader.data ?? []} isLoading={projectsDataLoader.isLoading} />
          </Box>
        )}
        {activeView === 'layers' && (
          <Box p={3} sx={{ overflow: 'auto' }}>
            <LayerPanel canSearch={isAuthenticated} />
          </Box>
        )}
      </Box>
    </Box>
  );
};
