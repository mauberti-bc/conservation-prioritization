import { mdiArrowLeft, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, IconButton, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import Paper from '@mui/material/Paper';
import { ComponentSwitch } from 'components/ComponentSwitch';
import { SidebarView } from 'context/sidebarUIContext';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { GetTaskResponse, GetTasksResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useProjectContext, useTaskContext } from 'hooks/useContext';
import { DataLoader } from 'hooks/useDataLoader';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { useLayerSearch } from 'hooks/useLayerSearch';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayerPanel } from '../layer-panel/LayerPanel';
import { EditTask } from '../task/create/EditTask';
import { SidebarNavigation } from './navigation/SidebarNavigation';
import { ProjectCreateDialog } from './projects/ProjectCreateDialog';
import { ProjectList } from './projects/ProjectList';
import { SidebarSection } from './SidebarSection';
import { TaskDetailsPanel } from './tasks/TaskDetailsPanel';
import { TaskList } from './tasks/TaskList';

interface SidebarProps {
  activeView: SidebarView | null;
  onViewChange: (newView: SidebarView | null) => void;
  tasksDataLoader: DataLoader<[pagination?: ApiPaginationRequestOptions], GetTasksResponse, unknown>;
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
  const { taskId, taskDataLoader, setFocusedTask } = useTaskContext();
  const conservationApi = useConservationApi();
  const navigate = useNavigate();
  const { refreshProjects } = useProjectContext();
  const [taskSearchTerm, setTaskSearchTerm] = useState('');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [taskPanelMode, setTaskPanelMode] = useState<'view' | 'edit'>('view');
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [projectCreateError, setProjectCreateError] = useState<string | null>(null);
  const [projectCreateSaving, setProjectCreateSaving] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectTasks, setSelectedProjectTasks] = useState<GetTaskResponse[]>([]);
  const [projectTasksLoading, setProjectTasksLoading] = useState(false);
  const getProjectTasksRef = useRef(conservationApi.project.getProjectTasks);
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
    const tasks = tasksDataLoader.data?.tasks ?? [];

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

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) {
      return null;
    }

    return (projectsDataLoader.data ?? []).find((project) => project.project_id === selectedProjectId) ?? null;
  }, [projectsDataLoader.data, selectedProjectId]);

  const handleCreateProject = async (values: { name: string; description: string }) => {
    try {
      setProjectCreateSaving(true);
      setProjectCreateError(null);

      await conservationApi.project.createProject({
        name: values.name,
        description: values.description.trim() && values.description,
      });

      await refreshProjects();
      setProjectCreateOpen(false);
    } catch (error) {
      console.error('Failed to create project', error);
      setProjectCreateError('Failed to create project. Please try again.');
    } finally {
      setProjectCreateSaving(false);
    }
  };

  useEffect(() => {
    getProjectTasksRef.current = conservationApi.project.getProjectTasks;
  }, [conservationApi.project]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProjectTasks([]);
      setProjectTasksLoading(false);
      return;
    }

    let isMounted = true;
    setProjectTasksLoading(true);

    const loadTasks = async () => {
      try {
        const tasks = await getProjectTasksRef.current(selectedProjectId);
        if (isMounted) {
          setSelectedProjectTasks(tasks);
        }
      } catch (error) {
        console.error('Failed to load project tasks', error);
        if (isMounted) {
          setSelectedProjectTasks([]);
        }
      } finally {
        if (isMounted) {
          setProjectTasksLoading(false);
        }
      }
    };

    void loadTasks();

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    if (activeView !== 'layers') {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    searchLayers('');
  }, [activeView, isAuthenticated, searchLayers]);

  useEffect(() => {
    if (activeView !== 'projects') {
      setSelectedProjectId(null);
    }
  }, [activeView]);
  const navWidth = 180;
  const viewKey = activeView ?? 'none';

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

      {activeView && (
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
            <ComponentSwitch
              value={viewKey}
              map={{
                tasks: (
                  <>
                    {!taskId && (
                      <SidebarSection
                        title="Tasks"
                        action={
                          <Button
                            variant="contained"
                            startIcon={<Icon path={mdiPlus} size={0.8} />}
                            onClick={() => {
                              navigate('/t/new');
                            }}>
                            Create Task
                          </Button>
                        }
                        onSearch={(term) => {
                          setTaskSearchTerm(term);
                        }}>
                        <TaskList
                          tasks={filteredTasks}
                          isLoading={tasksDataLoader.isLoading}
                          onSelectTask={(task) => {
                            setFocusedTask(task);
                            setTaskPanelMode('view');
                            onViewChange('tasks');
                          }}
                          onEditTask={(task) => {
                            setFocusedTask(task);
                            setTaskPanelMode('edit');
                            onViewChange('tasks');
                          }}
                        />
                      </SidebarSection>
                    )}
                    {taskId && taskPanelMode === 'view' && <TaskDetailsPanel />}
                    {taskId && taskPanelMode === 'edit' && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                        <Box display="flex" alignItems="center" gap={1} mb={2} p={2}>
                          <IconButton
                            aria-label="Back to tasks"
                            sx={{
                              color: grey[700],
                            }}
                            onClick={() => {
                              setFocusedTask(null);
                              setTaskPanelMode('view');
                            }}>
                            <Icon path={mdiArrowLeft} size={1} color="rgba(97, 97, 97, 1)" />
                          </IconButton>
                          <Typography
                            variant="subtitle1"
                            fontWeight={600}
                            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {taskDataLoader.data?.name ?? 'Edit task'}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, minHeight: 0 }}>
                          <EditTask taskId={taskId} />
                        </Box>
                      </Box>
                    )}
                  </>
                ),
                projects: (
                  <>
                    {!selectedProject && (
                      <SidebarSection
                        title="Projects"
                        action={
                          <Button
                            variant="contained"
                            startIcon={<Icon path={mdiPlus} size={0.8} />}
                            onClick={() => {
                              setProjectCreateError(null);
                              setProjectCreateOpen(true);
                            }}>
                            Create Project
                          </Button>
                        }
                        onSearch={(term) => {
                          setProjectSearchTerm(term);
                        }}>
                        <ProjectList
                          projects={filteredProjects}
                          isLoading={projectsDataLoader.isLoading}
                          onSelectProject={(project) => {
                            setSelectedProjectId(project.project_id);
                          }}
                        />
                      </SidebarSection>
                    )}
                    {selectedProject && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                        <Box display="flex" alignItems="center" gap={1} mb={2} p={2}>
                          <IconButton
                            aria-label="Back to projects"
                            onClick={() => {
                              setSelectedProjectId(null);
                            }}>
                            <Icon path={mdiArrowLeft} size={1} color="rgba(97, 97, 97, 1)" />
                          </IconButton>
                          <Typography
                            variant="subtitle1"
                            fontWeight={600}
                            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedProject.name}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', px: 2 }}>
                          <TaskList
                            tasks={selectedProjectTasks}
                            isLoading={projectTasksLoading}
                            onSelectTask={(task) => {
                              setFocusedTask(task);
                              setTaskPanelMode('view');
                              onViewChange('tasks');
                            }}
                          />
                        </Box>
                      </Box>
                    )}
                  </>
                ),
                layers: (
                  <SidebarSection
                    title="Layers"
                    onSearch={(term) => {
                      if (isAuthenticated) {
                        searchLayers(term);
                      }
                    }}>
                    <LayerPanel layers={layers} isLoading={layersLoading} error={layersError} />
                  </SidebarSection>
                ),
              }}
            />
          </Box>
        </Box>
      )}
      <ProjectCreateDialog
        open={projectCreateOpen}
        onCancel={() => {
          setProjectCreateOpen(false);
          setProjectCreateError(null);
        }}
        onSave={handleCreateProject}
        isSaving={projectCreateSaving}
        error={projectCreateError}
      />
    </Box>
  );
};
