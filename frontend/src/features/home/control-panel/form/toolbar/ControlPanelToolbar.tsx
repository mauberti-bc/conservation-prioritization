import { mdiBroom, mdiClipboardOutline, mdiContentSaveOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, TextField, Tooltip } from '@mui/material';
import { grey } from '@mui/material/colors';
import Stack from '@mui/material/Stack';
import { useFormikContext } from 'formik';
import { FormValues } from '../../ControlPanel';

export const ControlPanelToolbar = () => {
  const { values, setFieldValue, touched, errors, resetForm, submitForm } = useFormikContext<FormValues>();

  /** Save Draft → status='draft' then submit */
  const handleSaveDraft = () => {
    setFieldValue('status', 'draft');
    submitForm();
  };

  /** Reset → restores initialValues */
  const handleReset = () => resetForm();

  return (
    <Stack direction="row" spacing={2} alignItems="center" width="100%" pt={1}>
      <TextField
        fullWidth
        placeholder="Enter a name for your task"
        value={values.name || ''}
        onChange={(e) => setFieldValue('name', e.target.value)}
        error={touched.name && Boolean(errors.name)}
        slotProps={{ input: { startAdornment: <Icon path={mdiClipboardOutline} size={1} color={grey[600]} /> } }}
        helperText={touched.name && errors.name ? String(errors.name) : ''}
      />

      <Stack direction="row">
        {/* Save Draft */}
        <Tooltip title="Save Draft">
          <Button
            color="primary"
            onClick={handleSaveDraft}
            startIcon={<Icon path={mdiContentSaveOutline} size={0.8} />}>
            Save
          </Button>
        </Tooltip>

        {/* Reset */}
        <Tooltip title="Reset Form">
          <Button onClick={handleReset} startIcon={<Icon path={mdiBroom} size={0.8} />}>
            Clear
          </Button>
        </Tooltip>
      </Stack>
    </Stack>
  );
};
