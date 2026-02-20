import { TextField } from '@mui/material';
import Stack from '@mui/material/Stack';
import { useFormikContext } from 'formik';
import { TasksLandingTaskEditFormValues } from './tasks-landing.interface';

export const TasksLandingTaskEditForm = () => {
  const { values, errors, touched, handleChange, handleBlur } = useFormikContext<TasksLandingTaskEditFormValues>();

  return (
    <Stack spacing={2}>
      <TextField
        fullWidth
        id="name"
        name="name"
        label="Name"
        value={values.name}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.name && Boolean(errors.name)}
        helperText={touched.name && errors.name ? errors.name : ''}
        required
      />
      <TextField
        fullWidth
        id="description"
        name="description"
        label="Description"
        value={values.description}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.description && Boolean(errors.description)}
        helperText={touched.description && errors.description ? errors.description : ''}
        multiline
        minRows={2}
      />
    </Stack>
  );
};
