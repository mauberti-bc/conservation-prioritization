import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { DataLoader } from 'hooks/useDataLoader';
import { ACTIVE_VIEW } from '../HomePage';
import { LayerPanel } from '../layer-panel/LayerPanel';
import { CreateTaskPage } from '../task/create/CreateTaskPage';
import { SidebarNavigation } from './navigation/SidebarNavigation';
import { ProjectList } from './projects/ProjectList';
import { TaskDetailsPanel } from './tasks/TaskDetailsPanel';
import { TaskList } from './tasks/TaskList';

interface SidebarProps {
  activeView: ACTIVE_VIEW | null;
  onViewChange: (newView: ACTIVE_VIEW | null) => void;
  tasksDataLoader: DataLoader<[], GetTaskResponse[], unknown>;
  projectsDataLoader: DataLoader<[], GetProjectResponse[], unknown>;
  isAuthenticated: boolean;
  selectedTaskId: string | null;
  onSelectTask: (task: GetTaskResponse) => void;
}

export const Sidebar = ({
  activeView,
  onViewChange,
  tasksDataLoader,
  projectsDataLoader,
  isAuthenticated,
  selectedTaskId,
  onSelectTask,
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
          <Box sx={{ overflow: 'auto' }}>
            {selectedTaskId ? (
              <TaskDetailsPanel />
            ) : (
              <TaskList
                tasks={tasksDataLoader.data ?? []}
                isLoading={tasksDataLoader.isLoading}
                selectedTaskId={selectedTaskId}
                onSelectTask={onSelectTask}
              />
            )}
          </Box>
        )}
        {activeView === 'projects' && (
          <Box sx={{ overflow: 'auto' }}>
            <ProjectList
              projects={projectsDataLoader.data ?? []}
              isLoading={projectsDataLoader.isLoading}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
            />
          </Box>
        )}
        {activeView === 'layers' && (
          <Box sx={{ overflow: 'auto' }}>
            <LayerPanel canSearch={isAuthenticated} />
          </Box>
        )}
      </Box>
    </Box>
  );
};
