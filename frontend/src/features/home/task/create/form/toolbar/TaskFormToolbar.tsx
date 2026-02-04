import { mdiBroom, mdiClipboardOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, TextField, Tooltip } from '@mui/material';
import { grey } from '@mui/material/colors';
import Stack from '@mui/material/Stack';
import { useFormikContext } from 'formik';
import { useEffect, useState } from 'react';
import { TaskCreateFormValues } from '../TaskCreateForm';

export const TaskFormToolbar = () => {
  const { values, setFieldValue, touched, errors, resetForm } = useFormikContext<TaskCreateFormValues>();

  // Local state to track text field without hitting Formik on every keystroke
  const [localName, setLocalName] = useState(values.name || '');

  // Keep localName in sync if Formik values change externally
  useEffect(() => {
    setLocalName(values.name || '');
  }, [values.name]);

  /** Reset → restores initialValues */
  const handleReset = () => resetForm();

  /** Sync local value to Formik */
  const handleBlur = () => {
    setFieldValue('name', localName);
  };

  return (
    <Stack direction="row" spacing={2} alignItems="center" width="100%">
      <TextField
        fullWidth
        placeholder="Enter a name for your task"
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={handleBlur}
        error={touched.name && Boolean(errors.name)}
        slotProps={{
          input: {
            startAdornment: <Icon path={mdiClipboardOutline} size={1} color={grey[600]} />,
          },
        }}
        helperText={touched.name && errors.name ? String(errors.name) : ''}
      />

      <Stack direction="row">
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
