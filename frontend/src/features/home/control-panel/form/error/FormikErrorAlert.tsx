import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, AlertTitle, Box, IconButton, Stack } from '@mui/material';

export interface FormikErrorAlertProps {
  errors: { message: string }[];
  onClose: (message: string) => void;
}

export const FormikErrorAlert = ({ errors, onClose }: FormikErrorAlertProps) => {
  if (!errors || errors.length === 0) {
    return null;
  }

  // Remove duplicate messages
  const uniqueErrors = errors.filter(
    (item, index, self) => index === self.findIndex((t) => t.message === item.message)
  );

  return (
    <Stack spacing={1} mb={2} width="100%">
      {uniqueErrors.map((item, index) => (
        <Alert
          key={index}
          severity="error"
          variant="outlined"
          sx={{
            py: 1,
            px: 3,
            '& .MuiAlert-message': { flex: '1 1 auto', p: '8px 0 8px 8px' },
          }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              flex: '1 1 auto',
            }}>
            <AlertTitle
              variant="body2"
              sx={{
                flex: '1 1 auto',
                fontWeight: 500,
                wordBreak: 'break-word',
                whiteSpace: 'normal',
              }}>
              {item.message}
            </AlertTitle>

            <IconButton size="small" onClick={() => onClose(item.message)} color="error">
              <Icon path={mdiClose} size={0.75} />
            </IconButton>
          </Box>
        </Alert>
      ))}
    </Stack>
  );
};
