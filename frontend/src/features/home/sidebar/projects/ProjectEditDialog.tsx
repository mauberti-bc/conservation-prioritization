import { EditDialog } from 'components/dialog/EditDialog';
import { GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import * as Yup from 'yup';
import { ProjectEditForm, ProjectEditFormValues } from './ProjectEditForm';

interface ProjectEditDialogProps {
  open: boolean;
  project: GetProjectResponse | null;
  onCancel: () => void;
  onSave: (values: ProjectEditFormValues) => void;
  isSaving?: boolean;
  error?: string | null;
}

const validationSchema = Yup.object({
  name: Yup.string().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: Yup.string().max(500, 'Description must be 500 characters or less'),
});

export const ProjectEditDialog = ({ open, project, onCancel, onSave, isSaving, error }: ProjectEditDialogProps) => {
  if (!project) {
    return null;
  }

  const initialValues: ProjectEditFormValues = {
    name: project.name ?? '',
    description: project.description ?? '',
  };

  return (
    <EditDialog<ProjectEditFormValues>
      key={project.project_id}
      open={open}
      dialogTitle="Edit Project"
      dialogText="Update the project name and description."
      dialogSaveButtonLabel="Save"
      size="sm"
      dialogLoading={isSaving}
      dialogError={error ?? undefined}
      onCancel={onCancel}
      onSave={onSave}
      component={{
        element: <ProjectEditForm />,
        initialValues,
        validationSchema,
      }}
    />
  );
};
