import { Paper, TextField } from '@mui/material';
import { grey } from '@mui/material/colors';
import Stack from '@mui/material/Stack';
import { useFormikContext } from 'formik';
import { FormValues } from '../../ControlPanel';
import { ControlPanelGeometryForm } from './geometry/ControlPanelGeometryForm';

export const ControlPanelToolbar = () => {
  const { values, setFieldValue, touched, errors } = useFormikContext<FormValues>();

  return (
    <Stack direction="row" spacing={1} alignItems="center" width="100%" pt={0.25}>
      <TextField
        fullWidth
        placeholder="Scenario name"
        value={values.name || ''}
        onChange={(e) => setFieldValue('name', e.target.value)}
        error={touched.name && Boolean(errors.name)}
        helperText={touched.name && errors.name ? String(errors.name) : ''}
        sx={{
          bgcolor: grey[50],
          '& .MuiInputBase-root': {
            bgcolor: grey[50],
          },
        }}
      />

      <Paper variant="outlined" sx={{ px: 1, bgcolor: grey[50], height: '100%' }}>
        <ControlPanelGeometryForm />
      </Paper>
    </Stack>
  );
};
