import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useLayerSearch } from 'hooks/useLayerSearch';
import { DataLoader } from 'hooks/useDataLoader';
import { useEffect, useMemo, useState } from 'react';
import { SidebarView } from 'context/sidebarUIContext';
import { LayerPanel } from '../layer-panel/LayerPanel';
import { SidebarNavigation } from './navigation/SidebarNavigation';
import { ProjectList } from './projects/ProjectList';
import { TaskList } from './tasks/TaskList';
import { SidebarSection } from './SidebarSection';
import Typography from '@mui/material/Typography';

interface SidebarProps {
  activeView: SidebarView;
  onViewChange: (newView: SidebarView) => void;
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
  const [taskSearchTerm, setTaskSearchTerm] = useState('');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const { layers, loading: layersLoading, error: layersError, search: searchLayers } = useLayerSearch({
    debounceMs: 0,
    allowEmptySearch: isAuthenticated,
  });

  const filteredTasks = useMemo(() => {
    const term = taskSearchTerm.trim().toLowerCase();
    const tasks = tasksDataLoader.data ?? [];

    if (!term) {
      return tasks;
    }

    return tasks.filter((task) => {
      const haystack = `${task.name ?? ''} ${task.description ?? ''} ${task.status ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [taskSearchTerm, tasksDataLoader.data]);

  const filteredProjects = useMemo(() => {
    const term = projectSearchTerm.trim().toLowerCase();
    const projects = projectsDataLoader.data ?? [];

    if (!term) {
      return projects;
    }

    return projects.filter((project) => {
      const haystack = `${project.name ?? ''} ${project.description ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [projectSearchTerm, projectsDataLoader.data]);

  useEffect(() => {
    if (activeView !== 'layers') {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    searchLayers('');
  }, [activeView, isAuthenticated, searchLayers]);

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
        {activeView === 'new' && (
          <SidebarSection title="New task" onSearch={() => undefined} showSearch={false}>
            <Typography color="textSecondary">Configure your task in the main panel.</Typography>
          </SidebarSection>
        )}
        {activeView === 'tasks' && (
          <SidebarSection
            title="Tasks"
            onSearch={(term) => {
              setTaskSearchTerm(term);
            }}>
            {selectedTaskId ? (
              <Typography color="textSecondary">
                Task selected. Use the back arrow to return to the list.
              </Typography>
            ) : (
              <TaskList
                tasks={filteredTasks}
                isLoading={tasksDataLoader.isLoading}
                selectedTaskId={selectedTaskId}
                onSelectTask={onSelectTask}
              />
            )}
          </SidebarSection>
        )}
        {activeView === 'projects' && (
          <SidebarSection
            title="Projects"
            onSearch={(term) => {
              setProjectSearchTerm(term);
            }}>
            <ProjectList
              projects={filteredProjects}
              isLoading={projectsDataLoader.isLoading}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
            />
          </SidebarSection>
        )}
        {activeView === 'layers' && (
          <SidebarSection
            title="Layers"
            onSearch={(term) => {
              if (isAuthenticated) {
                searchLayers(term);
              }
            }}>
            <LayerPanel layers={layers} isLoading={layersLoading} error={layersError} />
          </SidebarSection>
        )}
      </Box>
    </Box>
  );
};
