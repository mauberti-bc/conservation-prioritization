import { Box, Typography } from '@mui/material';
import { EditDialog } from 'components/dialog/EditDialog';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { useProjectContext } from 'hooks/useContext';
import { useEffect, useMemo, useState } from 'react';
import { ProjectSelectList } from './ProjectSelectList';

interface AddTaskToProjectDialogProps {
  open: boolean;
  taskIds: string[];
  onClose: () => void;
  onSubmit: (projectIds: string[]) => Promise<void>;
}

/**
 * Dialog for adding tasks to one or more projects.
 */
export const AddTaskToProjectDialog = ({ open, taskIds, onClose, onSubmit }: AddTaskToProjectDialogProps) => {
  const { projectsDataLoader } = useProjectContext();
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setSelectedProjectIds([]);
      return;
    }

    void projectsDataLoader.load();
  }, [open, projectsDataLoader]);

  const projectOptions = useMemo<GetProjectResponse[]>(() => {
    return projectsDataLoader.data ?? [];
  }, [projectsDataLoader.data]);

  const handleSubmit = async () => {
    if (!selectedProjectIds.length || !taskIds.length) {
      return;
    }

    await onSubmit(selectedProjectIds);
  };

  return (
    <EditDialog<{}>
      open={open}
      size="sm"
      dialogTitle="Add task to project"
      dialogSaveButtonLabel="Add to Project"
      onCancel={onClose}
      onSave={handleSubmit}
      component={{
        initialValues: {},
        validationSchema: undefined,
        validateOnBlur: false,
        validateOnChange: false,
        element: (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Select one or more projects to add the selected task.
            </Typography>
            {projectsDataLoader.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading projects...
              </Typography>
            ) : (
              <ProjectSelectList
                projects={projectOptions}
                selectedProjectIds={selectedProjectIds}
                onToggleProject={(project) => {
                  if (selectedProjectIds.includes(project.project_id)) {
                    setSelectedProjectIds(selectedProjectIds.filter((id) => id !== project.project_id));
                    return;
                  }
                  setSelectedProjectIds([...selectedProjectIds, project.project_id]);
                }}
              />
            )}
          </Box>
        ),
      }}
    />
  );
};
