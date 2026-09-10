import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import DialogContentText from '@mui/material/DialogContentText';
import Typography from '@mui/material/Typography';
import { OkDialog } from 'components/dialog/OkDialog';
import { TaskExportFormat, TaskExportResponse } from 'hooks/interfaces/useTaskApi.interface';

interface TaskExportFormatDialogProps {
  open: boolean;
  exports: TaskExportResponse[];
  loadingFormat: TaskExportFormat | null;
  error: string | null;
  onClose: () => void;
  onDownload: (format: TaskExportFormat) => void;
  onExport: (format: TaskExportFormat) => void;
}

const FORMAT_OPTIONS: { label: string; format: TaskExportFormat }[] = [
  { label: 'GeoTIFF', format: 'geotiff' },
  { label: 'Geodatabase', format: 'geodatabase' },
];

const getLatestExportForFormat = (
  exports: TaskExportResponse[],
  format: TaskExportFormat
): TaskExportResponse | null => {
  return exports.find((taskExport) => taskExport.format === format) ?? null;
};

/**
 * Prompts the user to select an export format before queueing an export.
 *
 * @param {TaskExportFormatDialogProps} props Dialog state and export submission callbacks.
 * @returns {JSX.Element}
 */
export const TaskExportFormatDialog = ({
  open,
  exports,
  loadingFormat,
  error,
  onClose,
  onDownload,
  onExport,
}: TaskExportFormatDialogProps) => {
  const isLoading = Boolean(loadingFormat);

  return (
    <OkDialog
      open={open}
      onClose={onClose}
      dialogTitle="Create export"
      dialogText="Select an export format."
      dialogProps={{ fullWidth: true, maxWidth: 'xs', onClose: isLoading ? undefined : onClose }}
      dialogContent={
        <>
          {error ? (
            <DialogContentText color="error" sx={{ mt: 2 }}>
              {error}
            </DialogContentText>
          ) : null}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
            {FORMAT_OPTIONS.map((option) => {
              const taskExport = getLatestExportForFormat(exports, option.format);
              const isReady = taskExport?.status === 'ready';
              const isPreparing = taskExport?.status === 'queued' || taskExport?.status === 'running';

              return (
                <Box
                  key={option.format}
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Typography fontWeight={700}>{option.label}</Typography>
                  <Button
                    variant={isReady ? 'outlined' : 'contained'}
                    disabled={option.format === 'geodatabase'}
                    loading={loadingFormat === option.format || isPreparing}
                    onClick={() => {
                      if (isReady) {
                        onDownload(option.format);
                        return;
                      }

                      onExport(option.format);
                    }}>
                    {isReady ? 'Download' : 'Export'}
                  </Button>
                </Box>
              );
            })}
          </Box>
        </>
      }
    />
  );
};
