import { Box, List, ListItem, ListItemText, Typography } from '@mui/material';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';

interface ProjectListProps {
  projects: GetProjectResponse[];
  isLoading: boolean;
}

export const ProjectList = ({ projects, isLoading }: ProjectListProps) => {
  return (
    <Box
      sx={{
        mt: 2,
        mx: 1,
        p: 1,
        borderRadius: 1,
        maxHeight: '300px',
        overflowY: 'auto',
      }}>
      <Typography sx={{ mb: 1, px: 1 }}>Projects</Typography>
      {isLoading ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
          Loading projects...
        </Typography>
      ) : projects.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
          No projects available
        </Typography>
      ) : (
        <List dense>
          {projects.map((project) => (
            <ListItem key={project.project_id}>
              <ListItemText primary={project.name} secondary={project.description} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};
