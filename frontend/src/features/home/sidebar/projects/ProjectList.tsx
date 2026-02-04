import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { TaskList } from '../tasks/TaskList';
import Icon from '@mdi/react';
import { mdiChevronDown } from '@mdi/js';

interface ProjectListProps {
  projects: GetProjectResponse[];
  isLoading: boolean;
  selectedTaskId: string | null;
  onSelectTask: (task: GetTaskResponse) => void;
}

export const ProjectList = ({ projects, isLoading, selectedTaskId, onSelectTask }: ProjectListProps) => {
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
        <Box>
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
                  <Box>
                    <Typography fontWeight={600}>{project.name}</Typography>
                    {project.description && (
                      <Typography variant="body2" color="text.secondary">
                        {project.description}
                      </Typography>
                    )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0 }}>
                  <TaskList
                    tasks={projectTasks}
                    isLoading={false}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={onSelectTask}
                  />
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      </LoadingGuard>
    </Box>
  );
};
