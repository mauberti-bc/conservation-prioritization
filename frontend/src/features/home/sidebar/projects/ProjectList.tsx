import { Box, List, Typography } from '@mui/material';
import { InviteDialog } from 'components/dialog/InviteDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useProjectContext } from 'hooks/useContext';
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
  const dialogContext = useDialogContext();
  const { refreshProjects } = useProjectContext();
  const [editProject, setEditProject] = useState<GetProjectResponse | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [inviteProject, setInviteProject] = useState<GetProjectResponse | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const handleEditProject = (project: GetProjectResponse) => {
    setEditError(null);
    setEditProject(project);
  };

  const handleEditCancel = () => {
    setEditError(null);
    setEditProject(null);
  };

  const handleEditSave = async (values: { name: string; description: string; colour: string }) => {
    if (!editProject) {
      return;
    }

    try {
      setEditSaving(true);
      setEditError(null);

      await conservationApi.project.updateProject(editProject.project_id, {
        name: values.name,
        description: values.description.trim() ? values.description : undefined,
        colour: values.colour.trim() ? values.colour : undefined,
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

  const handleInviteProject = (project: GetProjectResponse) => {
    setInviteError(null);
    setInviteProject(project);
  };

  const handleInviteSubmit = async (emails: string[]) => {
    if (!inviteProject) {
      return;
    }

    try {
      setInviteLoading(true);
      setInviteError(null);

      const result = await conservationApi.project.inviteProfilesToProject(inviteProject.project_id, { emails });
      const skippedCount = result.skipped_emails.length;
      const addedCount = result.added_profile_ids.length;

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage:
          skippedCount > 0
            ? `Invited ${addedCount} profile(s). Skipped ${skippedCount} email(s).`
            : `Invited ${addedCount} profile(s).`,
      });

      setInviteProject(null);
    } catch (error) {
      console.error('Failed to invite profiles to project', error);
      setInviteError('Failed to send invites. Please try again.');
    } finally {
      setInviteLoading(false);
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
              onInvite={handleInviteProject}
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
      <InviteDialog
        open={Boolean(inviteProject)}
        title={inviteProject ? `Invite to ${inviteProject.name}` : 'Invite to Project'}
        description="Enter email addresses to add existing profiles to this project."
        onClose={() => {
          setInviteProject(null);
        }}
        onSubmit={handleInviteSubmit}
        isSubmitting={inviteLoading}
        error={inviteError}
      />
    </Box>
  );
};
