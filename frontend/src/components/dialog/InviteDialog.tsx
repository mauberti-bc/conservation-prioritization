import { LoadingButton } from '@mui/lab';
import { Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

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
  onSubmit
}: InviteDialogProps) => {
  const [emailInput, setEmailInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setEmailInput('');
    setLocalError(null);
  }, [open]);

  const { validEmails, invalidEmails } = useMemo(() => {
    const rawTokens = emailInput
      .split(/[\s,;]+/)
      .map((token) => token.trim())
      .filter((token) => Boolean(token));

    const uniqueEmails = Array.from(new Set(rawTokens.map((token) => token.toLowerCase())));
    const valid: string[] = [];
    const invalid: string[] = [];

    uniqueEmails.forEach((email) => {
      if (emailRegex.test(email)) {
        valid.push(email);
      } else {
        invalid.push(email);
      }
    });

    return { validEmails: valid, invalidEmails: invalid };
  }, [emailInput]);

  const handleSubmit = () => {
    setLocalError(null);

    if (!validEmails.length) {
      setLocalError('Enter at least one valid email address.');
      return;
    }

    onSubmit(validEmails);
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
        <TextField
          label="Email addresses"
          placeholder="Add emails separated by commas or new lines"
          multiline
          minRows={3}
          value={emailInput}
          onChange={(event) => {
            setEmailInput(event.target.value);
          }}
          fullWidth
          error={Boolean(localError || error || invalidEmails.length)}
          helperText={
            localError ??
            error ??
            (invalidEmails.length ? 'Some emails look invalid. They will be ignored.' : undefined)
          }
        />
        {(validEmails.length > 0 || invalidEmails.length > 0) && (
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {validEmails.map((email) => (
              <Chip key={email} label={email} color="primary" variant="outlined" />
            ))}
            {invalidEmails.map((email) => (
              <Chip key={email} label={email} color="warning" variant="outlined" />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <LoadingButton variant="contained" onClick={handleSubmit} loading={isSubmitting}>
          {submitLabel}
        </LoadingButton>
        <LoadingButton variant="outlined" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
