import { Box, List, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { ProjectListItem } from './ProjectListItem';

interface ProjectListProps {
  projects: GetProjectResponse[];
  isLoading: boolean;
  onSelectProject: (project: GetProjectResponse) => void;
  onEditProject?: (project: GetProjectResponse) => void;
  onDeleteProject?: (project: GetProjectResponse) => void;
  selectable?: boolean;
  selectedProjectIds?: string[];
  onToggleProject?: (project: GetProjectResponse) => void;
}

export const ProjectList = ({
  projects,
  isLoading,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  selectable = false,
  selectedProjectIds = [],
  onToggleProject,
}: ProjectListProps) => {
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
              onEditProject={onEditProject}
              onDeleteProject={onDeleteProject}
            />
          ))}
        </List>
      </LoadingGuard>
    </Box>
  );
};
