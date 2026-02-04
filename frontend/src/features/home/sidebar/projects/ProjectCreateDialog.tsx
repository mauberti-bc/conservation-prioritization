import { EditDialog } from 'components/dialog/EditDialog';
import * as Yup from 'yup';
import { ProjectEditForm, ProjectEditFormValues } from './ProjectEditForm';

interface ProjectCreateDialogProps {
  open: boolean;
  onCancel: () => void;
  onSave: (values: ProjectEditFormValues) => void;
  isSaving?: boolean;
  error?: string | null;
}

const validationSchema = Yup.object({
  name: Yup.string().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: Yup.string().max(500, 'Description must be 500 characters or less'),
  colour: Yup.string()
    .matches(/^#([0-9a-fA-F]{6})$/, { message: 'Colour must be a hex code like #1a5a96', excludeEmptyString: true })
    .max(7, 'Colour must be 7 characters or less'),
});

export const ProjectCreateDialog = ({ open, onCancel, onSave, isSaving, error }: ProjectCreateDialogProps) => {
  const initialValues: ProjectEditFormValues = {
    name: '',
    description: '',
    colour: '',
  };

  return (
    <EditDialog<ProjectEditFormValues>
      open={open}
      dialogTitle="Create Project"
      dialogText="Provide a name and description for the project."
      dialogSaveButtonLabel="Create"
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
