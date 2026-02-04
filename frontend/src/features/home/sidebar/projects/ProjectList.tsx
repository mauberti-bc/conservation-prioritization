import { mdiChevronDown } from '@mdi/js';
import Icon from '@mdi/react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Checkbox, Stack, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { TaskList } from '../tasks/TaskList';

interface ProjectListProps {
  projects: GetProjectResponse[];
  isLoading: boolean;
  onSelectTask: (task: GetTaskResponse) => void;
  selectable?: boolean;
  selectedProjectIds?: string[];
  onToggleProject?: (project: GetProjectResponse) => void;
}

export const ProjectList = ({
  projects,
  isLoading,
  onSelectTask,
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
        <Stack gap={1}>
          {projects.map((project) => {
            const projectTasks = project.tasks ?? [];

            return (
              <Accordion key={project.project_id} disableGutters elevation={0}>
                <AccordionSummary
                  expandIcon={<Icon path={mdiChevronDown} size={1} />}
                  sx={{
                    px: 1,
                    '& .MuiAccordionSummary-content': {
                      margin: 0,
                    },
                  }}>
                  <Box display="flex" alignItems="center" gap={1} width="100%">
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
                    <Box>
                      <Typography fontWeight={600}>{project.name}</Typography>
                      {project.description && (
                        <Typography variant="body2" color="text.secondary">
                          {project.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0 }}>
                  <TaskList
                    tasks={projectTasks}
                    isLoading={false}
                    onSelectTask={onSelectTask}
                    enableActions={false}
                    enableProjectDialog={false}
                  />
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>
      </LoadingGuard>
    </Box>
  );
};
