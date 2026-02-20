import { InviteDialog } from 'components/dialog/InviteDialog';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';

interface TaskViewInviteDialogProps {
  open: boolean;
  task: GetTaskResponse | undefined;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (emails: string[]) => Promise<void>;
}

export const TaskViewInviteDialog = ({
  open,
  task,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: TaskViewInviteDialogProps) => {
  return (
    <InviteDialog
      open={open}
      title={task ? `Invite to ${task.name}` : 'Invite to Task'}
      description="Enter email addresses to add existing profiles to this task."
      onClose={onClose}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      error={error}
    />
  );
};
