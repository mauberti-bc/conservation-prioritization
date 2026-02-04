import { Box, List, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useProjectContext } from 'hooks/useContext';
import { useState } from 'react';
import { ProjectEditDialog } from './ProjectEditDialog';
import { ProjectListItem } from './ProjectListItem';

interface ProjectListProps {
  projects: GetProjectResponse[];
  isLoading: boolean;
  onSelectProject: (project: GetProjectResponse) => void;
  onDeleteProject?: (project: GetProjectResponse) => void;
  selectable?: boolean;
  selectedProjectIds?: string[];
  onToggleProject?: (project: GetProjectResponse) => void;
}

export const ProjectList = ({
  projects,
  isLoading,
  onSelectProject,
  onDeleteProject,
  selectable = false,
  selectedProjectIds = [],
  onToggleProject,
}: ProjectListProps) => {
  const conservationApi = useConservationApi();
  const { refreshProjects } = useProjectContext();
  const [editProject, setEditProject] = useState<GetProjectResponse | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const handleEditProject = (project: GetProjectResponse) => {
    setEditError(null);
    setEditProject(project);
  };

  const handleEditCancel = () => {
    setEditError(null);
    setEditProject(null);
  };

  const handleEditSave = async (values: { name: string; description: string }) => {
    if (!editProject) {
      return;
    }

    try {
      setEditSaving(true);
      setEditError(null);

      await conservationApi.project.updateProject(editProject.project_id, {
        name: values.name,
        description: values.description.trim() ? values.description : undefined,
      });

      await refreshProjects();
      setEditProject(null);
    } catch (error) {
      console.error('Failed to update project', error);
      setEditError('Failed to update project. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <Box sx={{ overflowY: 'auto', maxHeight: '100%' }}>
      <LoadingGuard
        isLoading={isLoading}
        isLoadingFallback={
          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
            Loading projects...
          </Typography>
        }
        hasNoData={projects.length === 0}
        hasNoDataFallback={
          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
            No projects available
          </Typography>
        }>
        <List dense sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {projects.map((project) => (
            <ProjectListItem
              key={project.project_id}
              project={project}
              selectable={selectable}
              selectedProjectIds={selectedProjectIds}
              onToggleProject={onToggleProject}
              onSelectProject={onSelectProject}
              onEditProject={handleEditProject}
              onDeleteProject={onDeleteProject}
            />
          ))}
        </List>
      </LoadingGuard>
      <ProjectEditDialog
        open={Boolean(editProject)}
        project={editProject}
        onCancel={handleEditCancel}
        onSave={handleEditSave}
        isSaving={editSaving}
        error={editError}
      />
    </Box>
  );
};
