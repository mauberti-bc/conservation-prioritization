import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { SidebarView } from 'context/sidebarUIContext';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { DataLoader } from 'hooks/useDataLoader';
import { useLayerSearch } from 'hooks/useLayerSearch';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { LayerPanel } from '../layer-panel/LayerPanel';
import { CreateTask } from '../task/create/CreateTask';
import { SidebarNavigation } from './navigation/SidebarNavigation';
import { ProjectList } from './projects/ProjectList';
import { SidebarSection } from './SidebarSection';
import { TaskList } from './tasks/TaskList';

interface SidebarProps {
  activeView: SidebarView;
  onViewChange: (newView: SidebarView) => void;
  tasksDataLoader: DataLoader<[], GetTaskResponse[], unknown>;
  projectsDataLoader: DataLoader<[], GetProjectResponse[], unknown>;
  isAuthenticated: boolean;
  onSelectTask: (task: GetTaskResponse) => void;
  onTaskCreated?: () => void;
  onEditTask?: (task: GetTaskResponse) => void;
  overlay?: ReactNode;
  isOverlayOpen?: boolean;
}

export const Sidebar = ({
  activeView,
  onViewChange,
  tasksDataLoader,
  projectsDataLoader,
  isAuthenticated,
  onSelectTask,
  onTaskCreated,
  onEditTask,
  overlay,
  isOverlayOpen = false,
}: SidebarProps) => {
  // Task selection state comes from TaskContext; Sidebar only renders lists.
  const [taskSearchTerm, setTaskSearchTerm] = useState('');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const {
    layers,
    loading: layersLoading,
    error: layersError,
    search: searchLayers,
  } = useLayerSearch({
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

  const navWidth = 180;

  return (
    <Box display="flex" height="100%" zIndex={8} width="100%" position="relative">
      {/* Sidebar navigation tabs */}
      <Paper
        elevation={0}
        sx={{
          width: `${navWidth}px`,
          minWidth: `${navWidth}px`,
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
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {activeView === 'new' && (
            <CreateTask
              onTaskCreated={() => {
                onTaskCreated?.();
              }}
            />
          )}
          {activeView === 'tasks' && (
            <SidebarSection
              title="Tasks"
              onSearch={(term) => {
                setTaskSearchTerm(term);
              }}>
              <TaskList
                tasks={filteredTasks}
                isLoading={tasksDataLoader.isLoading}
                onSelectTask={onSelectTask}
                onEditTask={onEditTask}
              />
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

      {isOverlayOpen && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${navWidth}px`,
            right: 0,
            zIndex: 10,
            backgroundColor: 'background.paper',
          }}>
          {overlay}
        </Box>
      )}
    </Box>
  );
};
