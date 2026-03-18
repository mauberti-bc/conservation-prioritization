import { EditDialog } from 'components/dialog/EditDialog';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext } from 'hooks/useContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { CreateDraftTaskForm } from './form/edit/CreateDraftTaskForm';
import { CreateDraftTaskFormValues } from './form/edit/create-draft-task.interface';

interface CreateDraftTaskDialogProps {
  open: boolean;
  onClose: () => void;
}

const validationSchema = Yup.object({
  name: Yup.string().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: Yup.string().max(500, 'Description must be 500 characters or less'),
});

/**
 * Dialog for creating a task before map-based submission.
 *
 * @param {CreateDraftTaskDialogProps} props
 * @returns {JSX.Element}
 */
export const CreateDraftTaskDialog = ({ open, onClose }: CreateDraftTaskDialogProps) => {
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialValues: CreateDraftTaskFormValues = {
    name: '',
    description: '',
  };

  const handleSave = async (values: CreateDraftTaskFormValues) => {
    try {
      setIsSaving(true);
      setError(null);

      const createdTask = await conservationApi.task.createDraftTask({
        name: values.name,
        description: values.description.trim() ? values.description.trim() : null,
      });

      onClose();
      navigate(`/t/${createdTask.task_id}`);

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Task created.',
      });
    } catch (requestError) {
      console.error(requestError);
      setError('Failed to create task.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditDialog<CreateDraftTaskFormValues>
      open={open}
      size="sm"
      dialogTitle="Create Task"
      dialogText="Enter a name and description to create a task."
      dialogSaveButtonLabel="Create"
      dialogLoading={isSaving}
      dialogError={error ?? undefined}
      onCancel={() => {
        setError(null);
        onClose();
      }}
      onSave={handleSave}
      component={{
        element: <CreateDraftTaskForm />,
        initialValues,
        validationSchema,
      }}
    />
  );
};
