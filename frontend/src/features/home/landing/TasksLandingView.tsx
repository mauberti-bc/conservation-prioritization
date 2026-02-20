import {
  mdiAccountPlusOutline,
  mdiDeleteOutline,
  mdiFolderPlusOutline,
  mdiMagnify,
  mdiPencilOutline,
  mdiPlus,
} from '@mdi/js';
import Icon from '@mdi/react';
import {
  Box,
  Button,
  ButtonGroup,
  Container,
  debounce,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { EditDialog } from 'components/dialog/EditDialog';
import { InviteDialog } from 'components/dialog/InviteDialog';
import { ProjectCreateDialog } from 'features/home/sidebar/projects/ProjectCreateDialog';
import { ProjectEditDialog } from 'features/home/sidebar/projects/ProjectEditDialog';
import { ProjectEditFormValues } from 'features/home/sidebar/projects/ProjectEditForm';
import { AddTaskToProjectDialog } from 'features/home/sidebar/tasks/dialog/AddTaskToProjectDialog';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useProjectContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { toApiHexColour } from 'utils/colour';
import * as Yup from 'yup';
import { TasksLandingTaskEditFormValues } from './form/tasks-landing.interface';
import { TasksLandingTaskEditForm } from './form/TasksLandingTaskEditForm';
import { TaskGridCard } from './TaskGridCard';

const defaultPagination: ApiPaginationRequestOptions = {
  page: 1,
  limit: 25,
  sort: 'created_at',
  order: 'desc',
};

const taskEditSchema = Yup.object({
  name: Yup.string().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: Yup.string().max(500, 'Description must be 500 characters or less'),
});

/**
 * Landing page content for browsing and filtering task tiles.
 */
export const TasksLandingView = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const conservationApi = useConservationApi();
  const tasksDataLoader = useDataLoader(conservationApi.task.getAllTasks);
  const dialogContext = useDialogContext();
  const { projectsDataLoader, refreshProjects } = useProjectContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [projectCreateError, setProjectCreateError] = useState<string | null>(null);
  const [projectCreateSaving, setProjectCreateSaving] = useState(false);
  const [editProject, setEditProject] = useState<GetProjectResponse | null>(null);
  const [editProjectError, setEditProjectError] = useState<string | null>(null);
  const [editProjectSaving, setEditProjectSaving] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectDialogTaskIds, setProjectDialogTaskIds] = useState<string[]>([]);
  const [inviteTask, setInviteTask] = useState<GetTaskResponse | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editTask, setEditTask] = useState<GetTaskResponse | null>(null);
  const [editTaskError, setEditTaskError] = useState<string | null>(null);
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const refreshTasksRef = useRef(tasksDataLoader.refresh);
  refreshTasksRef.current = tasksDataLoader.refresh;

  const rawTasks = tasksDataLoader.data?.tasks;
  const projects = projectsDataLoader.data ?? [];

  const debouncedSearch = useMemo(() => {
    return debounce((value: string) => {
      setDebouncedSearchTerm(value.trim());
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      debouncedSearch.clear();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    void projectsDataLoader.load();
  }, [projectsDataLoader]);

  useEffect(() => {
    void refreshTasksRef.current({
      ...defaultPagination,
      search: debouncedSearchTerm || undefined,
    });
  }, [debouncedSearchTerm]);

  const refreshLandingTasks = async () => {
    await refreshTasksRef.current({
      ...defaultPagination,
      search: debouncedSearchTerm || undefined,
    });
  };

  const filteredTasks = useMemo(() => {
    const tasks = rawTasks ?? [];

    return tasks.filter((task) => {
      if (selectedProjectId) {
        const hasProject = task.projects?.some((project) => {
          return project.project_id === selectedProjectId;
        });

        if (!hasProject) {
          return false;
        }
      }
      return true;
    });
  }, [rawTasks, selectedProjectId]);

  const handleCreateProject = async (values: ProjectEditFormValues) => {
    try {
      setProjectCreateSaving(true);
      setProjectCreateError(null);

      await conservationApi.project.createProject({
        name: values.name,
        description: values.description.trim() ? values.description : '',
        colour: toApiHexColour(values.colour),
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

  const handleEditProject = (project: GetProjectResponse) => {
    setEditProjectError(null);
    setEditProject(project);
  };

  const handleEditProjectCancel = () => {
    setEditProjectError(null);
    setEditProject(null);
  };

  const handleEditProjectSave = async (values: ProjectEditFormValues) => {
    if (!editProject) {
      return;
    }

    try {
      setEditProjectSaving(true);
      setEditProjectError(null);

      await conservationApi.project.updateProject(editProject.project_id, {
        name: values.name,
        description: values.description.trim() ? values.description : undefined,
        colour: toApiHexColour(values.colour),
      });

      await refreshProjects();
      await refreshLandingTasks();
      setEditProject(null);
    } catch (error) {
      console.error('Failed to update project', error);
      setEditProjectError('Failed to update project. Please try again.');
    } finally {
      setEditProjectSaving(false);
    }
  };

  const handleDeleteProject = (project: GetProjectResponse) => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete Project?',
      dialogText: `Are you sure you want to delete "${project.name}"?`,
      onYes: async () => {
        dialogContext.setYesNoDialog({ open: false });
        await conservationApi.project.deleteProject(project.project_id);

        if (selectedProjectId === project.project_id) {
          setSelectedProjectId(null);
        }

        await refreshProjects();
        await refreshLandingTasks();
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
    });
  };

  const handleOpenTask = (taskId: string) => {
    navigate(`/t/${taskId}`);
  };

  const handleDeleteTask = (task: GetTaskResponse) => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete Task?',
      dialogText: `Are you sure you want to delete "${task.name}"?`,
      onYes: async () => {
        dialogContext.setYesNoDialog({ open: false });
        await conservationApi.task.deleteTask(task.task_id);
        await refreshLandingTasks();
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
    });
  };

  const handleAddToProject = (task: GetTaskResponse) => {
    setProjectDialogTaskIds([task.task_id]);
    setProjectDialogOpen(true);
  };

  const handleConfirmAddToProject = async (projectIds: string[]) => {
    if (projectIds.length === 0 || projectDialogTaskIds.length === 0) {
      return;
    }

    await Promise.all(
      projectDialogTaskIds.map((taskId) => {
        return conservationApi.task.addProjectsToTask(taskId, projectIds);
      })
    );

    await refreshProjects();
    await refreshLandingTasks();
    setProjectDialogOpen(false);
  };

  const handleInviteTask = (task: GetTaskResponse) => {
    setInviteError(null);
    setInviteTask(task);
  };

  const handleEditTask = (task: GetTaskResponse) => {
    setEditTaskError(null);
    setEditTask(task);
  };

  const handleEditTaskCancel = () => {
    setEditTaskError(null);
    setEditTask(null);
  };

  const handleEditTaskSave = async (values: TasksLandingTaskEditFormValues) => {
    if (!editTask) {
      return;
    }

    try {
      setEditTaskSaving(true);
      setEditTaskError(null);

      await conservationApi.task.updateTask(editTask.task_id, {
        name: values.name,
        description: values.description.trim() ? values.description : null,
      });

      await refreshLandingTasks();
      setEditTask(null);
    } catch (error) {
      console.error('Failed to update task', error);
      setEditTaskError('Failed to update task. Please try again.');
    } finally {
      setEditTaskSaving(false);
    }
  };

  const handleInviteSubmit = async (emails: string[]) => {
    if (!inviteTask) {
      return;
    }

    try {
      setInviteLoading(true);
      setInviteError(null);

      const result = await conservationApi.task.inviteProfilesToTask(inviteTask.task_id, { emails });
      const skippedCount = result.skipped_emails.length;
      const addedCount = result.added_profile_ids.length;

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage:
          skippedCount > 0
            ? `Invited ${addedCount} profile(s). Skipped ${skippedCount} email(s).`
            : `Invited ${addedCount} profile(s).`,
      });

      setInviteTask(null);
    } catch (error) {
      console.error('Failed to invite profiles to task', error);
      setInviteError('Failed to send invites. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  const hasNoFilteredTasks = !tasksDataLoader.isLoading && filteredTasks.length === 0;
  const projectChipHeight = 36;

  return (
    <Box sx={{ height: '100%', overflow: 'auto', py: { xs: 2, md: 3 } }}>
      <Container maxWidth="lg">
        <Stack spacing={2.5}>
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
            <Typography variant="h1">Tasks</Typography>
            <Button
              variant="contained"
              onClick={() => {
                navigate('/t/new');
              }}>
              + Create Task
            </Button>
          </Box>

          <TextField
            fullWidth
            value={searchTerm}
            onChange={(event) => {
              const nextSearch = event.target.value;
              setSearchTerm(nextSearch);
              debouncedSearch(nextSearch);
            }}
            placeholder="Search tasks"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon path={mdiMagnify} size={1} color={theme.palette.text.secondary} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Box display="flex" alignItems="stretch" gap={1} flexWrap="wrap">
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="stretch">
              <Button
                variant="contained"
                color="inherit"
                onClick={() => {
                  setSelectedProjectId(null);
                }}
                sx={{
                  backgroundColor: selectedProjectId ? grey[50] : theme.palette.selected.main,
                  color: selectedProjectId ? undefined : theme.palette.selected.contrastText,
                  height: `${projectChipHeight}px`,
                }}>
                All
              </Button>
              {projects.map((project) => {
                const isSelected = selectedProjectId === project.project_id;
                return (
                  <ButtonGroup
                    key={project.project_id}
                    variant="contained"
                    color="inherit"
                    sx={{
                      '& .MuiButton-root': {
                        backgroundColor: isSelected ? theme.palette.selected.main : grey[50],
                        color: isSelected ? theme.palette.selected.contrastText : undefined,
                        height: `${projectChipHeight}px`,
                        minWidth: 0,
                        py: 0.25,
                      },
                    }}>
                    <Button
                      sx={{ px: 1.25 }}
                      startIcon={
                        <Box
                          sx={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            bgcolor: project.colour,
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        />
                      }
                      onClick={() => {
                        if (isSelected) {
                          setSelectedProjectId(null);
                          return;
                        }
                        setSelectedProjectId(project.project_id);
                      }}>
                      {project.name}
                    </Button>
                    <Button
                      sx={{ px: 0.5, minWidth: `${projectChipHeight}px` }}
                      onClick={(event) => {
                        event.stopPropagation();
                      }}>
                      <IconMenuButton
                        inlineTrigger
                        items={[
                          {
                            label: 'Edit',
                            icon: mdiPencilOutline,
                            onClick: () => {
                              handleEditProject(project);
                            },
                          },
                          {
                            label: 'Delete',
                            icon: mdiDeleteOutline,
                            onClick: () => {
                              handleDeleteProject(project);
                            },
                          },
                        ]}
                      />
                    </Button>
                  </ButtonGroup>
                );
              })}
              <IconButton
                aria-label="Create project"
                sx={{
                  height: `${projectChipHeight}px`,
                  width: `${projectChipHeight}px`,
                  backgroundColor: grey[50],
                }}
                onClick={() => {
                  setProjectCreateError(null);
                  setProjectCreateOpen(true);
                }}>
                <Icon path={mdiPlus} size={1} />
              </IconButton>
            </Box>
          </Box>

          {tasksDataLoader.isLoading && (
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
              }}>
              {Array.from({ length: 8 }).map((_, index) => {
                return (
                  <Box
                    key={index}
                    sx={{
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}>
                    <Skeleton variant="rectangular" animation="wave" sx={{ aspectRatio: '4 / 3' }} />
                    <Box sx={{ p: 2 }}>
                      <Skeleton variant="text" width="70%" />
                      <Skeleton variant="text" width="90%" />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {!tasksDataLoader.isLoading && !hasNoFilteredTasks && (
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
              }}>
              {filteredTasks.map((task) => {
                return (
                  <TaskGridCard
                    key={task.task_id}
                    task={task}
                    onClick={(selectedTask) => {
                      handleOpenTask(selectedTask.task_id);
                    }}
                    menuItems={[
                      {
                        label: 'Share',
                        icon: mdiAccountPlusOutline,
                        onClick: () => {
                          handleInviteTask(task);
                        },
                      },
                      {
                        label: 'Add to Project',
                        icon: mdiFolderPlusOutline,
                        onClick: () => {
                          handleAddToProject(task);
                        },
                      },
                      {
                        label: 'Edit',
                        icon: mdiPencilOutline,
                        onClick: () => {
                          handleEditTask(task);
                        },
                      },
                      {
                        label: 'Delete',
                        icon: mdiDeleteOutline,
                        onClick: () => {
                          handleDeleteTask(task);
                        },
                      },
                    ]}
                  />
                );
              })}
            </Box>
          )}

          {hasNoFilteredTasks && (
            <Box
              sx={{
                bgcolor: grey[50],
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                p: 8,
                textAlign: 'center',
              }}>
              <Typography fontWeight={700}>No tasks found</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                Try another search or create a new task.
              </Typography>
            </Box>
          )}
        </Stack>
      </Container>

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
      <ProjectEditDialog
        open={Boolean(editProject)}
        project={editProject}
        onCancel={handleEditProjectCancel}
        onSave={handleEditProjectSave}
        isSaving={editProjectSaving}
        error={editProjectError}
      />
      <AddTaskToProjectDialog
        open={projectDialogOpen}
        taskIds={projectDialogTaskIds}
        onClose={() => {
          setProjectDialogOpen(false);
        }}
        onSubmit={handleConfirmAddToProject}
      />
      <InviteDialog
        open={Boolean(inviteTask)}
        title={inviteTask ? `Invite to ${inviteTask.name}` : 'Invite to Task'}
        description="Enter email addresses to add existing profiles to this task."
        onClose={() => {
          setInviteTask(null);
        }}
        onSubmit={handleInviteSubmit}
        isSubmitting={inviteLoading}
        error={inviteError}
      />
      <EditDialog<TasksLandingTaskEditFormValues>
        open={Boolean(editTask)}
        dialogTitle="Edit Task"
        dialogText="Update the task name and description."
        dialogSaveButtonLabel="Save"
        size="sm"
        dialogLoading={editTaskSaving}
        dialogError={editTaskError ?? undefined}
        onCancel={handleEditTaskCancel}
        onSave={handleEditTaskSave}
        component={{
          element: <TasksLandingTaskEditForm />,
          initialValues: {
            name: editTask?.name ?? '',
            description: editTask?.description ?? '',
          },
          validationSchema: taskEditSchema,
        }}
      />
    </Box>
  );
};
