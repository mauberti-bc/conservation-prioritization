import { Box, Checkbox, Chip, List, ListItem, ListItemText, Typography } from '@mui/material';
import { InteractiveListItemButton } from 'components/list/InteractiveListItemButton';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';

interface ProjectSelectListProps {
  projects: GetProjectResponse[];
  selectedProjectIds: string[];
  onToggleProject: (project: GetProjectResponse) => void;
}

/**
 * Selectable project list used inside dialogs (no action menu).
 */
export const ProjectSelectList = ({ projects, selectedProjectIds, onToggleProject }: ProjectSelectListProps) => {
  return (
    <List dense sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {projects.map((project) => {
        const taskCount = project.task_count ?? project.tasks?.length ?? 0;
        const isSelected = selectedProjectIds.includes(project.project_id);

        return (
          <ListItem key={project.project_id} disablePadding>
            <InteractiveListItemButton
              onClick={() => {
                onToggleProject(project);
              }}>
              <Box display="flex" alignItems="center" gap={1} width="100%">
                <Checkbox checked={isSelected} />
                <ListItemText
                  primary={
                    <Typography fontWeight={700} noWrap>
                      {project.name}
                    </Typography>
                  }
                  secondary={project.description}
                />
                <Chip size="small" label={taskCount} sx={{ px: 1, width: 'fit-content' }} />
              </Box>
            </InteractiveListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
};
