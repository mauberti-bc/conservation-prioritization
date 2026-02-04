import { MenuItem, Stack, TextField } from '@mui/material';
import { LabelledSection } from 'components/layout/LabelledSection';
import { useFormikContext } from 'formik';

export interface PublishDashboardFormValues {
  name: string;
  access_scheme: 'ANYONE_WITH_LINK' | 'MEMBERS_ONLY' | 'NOBODY';
}

/**
 * Form fields for publishing a dashboard.
 *
 * @return {*}
 */
export const PublishDashboardForm = () => {
  const { values, errors, touched, handleChange } = useFormikContext<PublishDashboardFormValues>();

  return (
    <Stack spacing={2}>
      <LabelledSection label="Name">
        <TextField
          name="name"
          placeholder="Dashboard name"
          hiddenLabel
          required
          fullWidth
          value={values.name}
          onChange={handleChange}
          error={Boolean(touched.name && errors.name)}
          helperText={touched.name && errors.name ? errors.name : ' '}
          inputProps={{ 'aria-label': 'Dashboard name' }}
        />
      </LabelledSection>

      <LabelledSection label="Who has access?">
        <TextField
          name="access_scheme"
          select
          hiddenLabel
          required
          fullWidth
          value={values.access_scheme}
          onChange={handleChange}
          error={Boolean(touched.access_scheme && errors.access_scheme)}
          helperText={touched.access_scheme && errors.access_scheme ? errors.access_scheme : ' '}
          inputProps={{ 'aria-label': 'Access scheme' }}>
          <MenuItem value="ANYONE_WITH_LINK">Anyone with link</MenuItem>
          <MenuItem value="MEMBERS_ONLY">Members only</MenuItem>
          <MenuItem value="NOBODY">Nobody</MenuItem>
        </TextField>
      </LabelledSection>
    </Stack>
  );
};
