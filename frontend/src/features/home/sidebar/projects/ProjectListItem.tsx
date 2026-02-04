import { mdiAccountPlus, mdiDelete, mdiPencil } from '@mdi/js';
import { Box, Checkbox, Chip, ListItem, Typography } from '@mui/material';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { InteractiveListItemButton } from 'components/list/InteractiveListItemButton';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';

interface ProjectListItemProps {
  project: GetProjectResponse;
  onSelectProject: (project: GetProjectResponse) => void;
  onEditProject?: (project: GetProjectResponse) => void;
  onDeleteProject?: (project: GetProjectResponse) => void;
  onInvite?: (project: GetProjectResponse) => void;
  selectable: boolean;
  selectedProjectIds: string[];
  onToggleProject?: (project: GetProjectResponse) => void;
}

export const ProjectListItem = ({
  project,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onInvite,
  selectable,
  selectedProjectIds,
  onToggleProject,
}: ProjectListItemProps) => {
  const taskCount = project.task_count ?? project.tasks?.length ?? 0;
  const menuItems = [
    {
      label: 'Edit',
      icon: mdiPencil,
      onClick: () => {
        onEditProject?.(project);
      },
    },
    {
      label: 'Invite',
      icon: mdiAccountPlus,
      onClick: () => {
        onInvite?.(project);
      },
    },
    {
      label: 'Delete',
      icon: mdiDelete,
      onClick: () => {
        onDeleteProject?.(project);
      },
    },
  ];

  return (
    <ListItem
      key={project.project_id}
      disablePadding
      secondaryAction={
        <Box
          onClick={(event) => {
            event.stopPropagation();
          }}>
          <IconMenuButton items={menuItems} />
        </Box>
      }>
      <InteractiveListItemButton
        onClick={() => {
          onSelectProject(project);
        }}>
        <Box display="flex" alignItems="center" gap={1} width="100%" minWidth={0} py={1}>
          {selectable && (
            <Checkbox
              checked={selectedProjectIds.includes(project.project_id)}
              onClick={(event) => {
                event.stopPropagation();
              }}
              onChange={(event) => {
                event.stopPropagation();
                onToggleProject?.(project);
              }}
            />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
              <Typography fontWeight={600} sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {project.name}
              </Typography>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: project.colour,
                  flexShrink: 0,
                }}
              />
            </Box>
            {project.description && (
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {project.description}
              </Typography>
            )}
          </Box>
          <Chip
            size="small"
            label={taskCount}
            sx={{ px: 1, mx: 2, width: 'fit-content', '& .MuiChip-label': { fontWeight: 700 } }}
          />
        </Box>
      </InteractiveListItemButton>
    </ListItem>
  );
};
