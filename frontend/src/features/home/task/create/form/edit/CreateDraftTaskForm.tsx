import { Box, TextField } from '@mui/material';
import { useFormikContext } from 'formik';
import { CreateDraftTaskFormValues } from './create-draft-task.interface';

export const CreateDraftTaskForm = () => {
  const { values, errors, touched, handleChange, handleBlur } = useFormikContext<CreateDraftTaskFormValues>();

  return (
    <Box display="flex" flexDirection="column" gap={2}>
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
    </Box>
  );
};
