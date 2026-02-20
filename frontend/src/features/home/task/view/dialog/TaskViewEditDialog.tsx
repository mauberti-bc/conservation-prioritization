import { EditDialog } from 'components/dialog/EditDialog';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import * as Yup from 'yup';
import { TaskViewPanelEditForm } from '../panel/TaskViewPanelEditForm';
import { TaskEditFormValues } from '../panel/task-view-panel.interface';

interface TaskViewEditDialogProps {
  open: boolean;
  task: GetTaskResponse | undefined;
  isSaving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (values: TaskEditFormValues) => Promise<void>;
}

const taskEditSchema = Yup.object({
  name: Yup.string().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: Yup.string().max(500, 'Description must be 500 characters or less'),
});

export const TaskViewEditDialog = ({ open, task, isSaving, error, onCancel, onSave }: TaskViewEditDialogProps) => {
  return (
    <EditDialog<TaskEditFormValues>
      open={open}
      dialogTitle="Edit Task"
      dialogText="Update the task name and description."
      dialogSaveButtonLabel="Save"
      size="sm"
      dialogLoading={isSaving}
      dialogError={error ?? undefined}
      onCancel={onCancel}
      onSave={onSave}
      component={{
        element: <TaskViewPanelEditForm />,
        initialValues: {
          name: task?.name ?? '',
          description: task?.description ?? '',
        },
        validationSchema: taskEditSchema,
      }}
    />
  );
};
