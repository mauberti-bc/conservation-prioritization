import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { TaskExportFormat } from 'hooks/interfaces/useTaskApi.interface';

interface TaskExportFormatDialogProps {
  open: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (format: TaskExportFormat) => void;
}

const FORMAT_OPTIONS: { label: string; format: TaskExportFormat }[] = [
  { label: 'GeoTIFF', format: 'geotiff' },
  { label: 'Geodatabase', format: 'geodatabase' },
];

/**
 * Prompts the user to select an export format before queueing an export.
 *
 * @param {TaskExportFormatDialogProps} props Dialog state and export submission callbacks.
 * @returns {JSX.Element}
 */
export const TaskExportFormatDialog = ({
  open,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: TaskExportFormatDialogProps) => {
  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={isSubmitting ? undefined : onClose}>
      <DialogTitle>Create export</DialogTitle>
      <DialogContent>
        <DialogContentText>Select an export format for this completed task run.</DialogContentText>
        {error ? (
          <DialogContentText color="error" sx={{ mt: 2 }}>
            {error}
          </DialogContentText>
        ) : null}
      </DialogContent>
      <DialogActions>
        {FORMAT_OPTIONS.map((option) => (
          <Button
            key={option.format}
            variant={option.format === 'geotiff' ? 'contained' : 'outlined'}
            disabled={isSubmitting}
            onClick={() => {
              onSubmit(option.format);
            }}>
            {option.label}
          </Button>
        ))}
        <Button disabled={isSubmitting} onClick={onClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};
