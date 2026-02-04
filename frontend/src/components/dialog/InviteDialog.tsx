import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { FieldArray, Form, Formik } from 'formik';
import { useEffect, useState } from 'react';

interface InviteDialogProps {
  open: boolean;
  title: string;
  description?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (emails: string[]) => void;
}

/**
 * Dialog for inviting profiles by email address.
 *
 * @param {InviteDialogProps} props
 * @returns {JSX.Element | null}
 */
export const InviteDialog = ({
  open,
  title,
  description,
  submitLabel = 'Invite',
  isSubmitting = false,
  error,
  onClose,
  onSubmit,
}: InviteDialogProps) => {
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLocalError(null);
  }, [open]);

  const handleSubmit = (emails: string[]) => {
    setLocalError(null);

    const cleanedEmails = emails.map((email) => email.trim()).filter((value) => Boolean(value));

    if (!cleanedEmails.length) {
      setLocalError('Enter at least one valid email address.');
      return;
    }

    onSubmit(cleanedEmails);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}
        <Formik
          initialValues={{ emails: [''] }}
          onSubmit={(values) => {
            handleSubmit(values.emails);
          }}>
          {({ values, handleChange }) => (
            <Form>
              <FieldArray
                name="emails"
                render={(arrayHelpers) => (
                  <Box display="flex" flexDirection="column" gap={2}>
                    {values.emails.map((email, index) => (
                      <TextField
                        key={`email-${index}`}
                        label={`Email ${index + 1}`}
                        name={`emails.${index}`}
                        value={email}
                        onChange={handleChange}
                        fullWidth
                        error={Boolean(localError || error)}
                      />
                    ))}
                    {(localError || error) && (
                      <Typography variant="body2" color="error">
                        {localError ?? error}
                      </Typography>
                    )}
                    <Button
                      variant="text"
                      startIcon={<Icon path={mdiPlus} size={0.8} />}
                      onClick={() => {
                        arrayHelpers.push('');
                      }}>
                      Add Another
                    </Button>
                    <DialogActions sx={{ px: 0 }}>
                      <LoadingButton variant="contained" type="submit" loading={isSubmitting}>
                        {submitLabel}
                      </LoadingButton>
                      <LoadingButton variant="outlined" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                      </LoadingButton>
                    </DialogActions>
                  </Box>
                )}
              />
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
};
