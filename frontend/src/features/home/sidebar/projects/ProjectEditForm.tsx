import { TextField } from '@mui/material';
import { useFormikContext } from 'formik';

export interface ProjectEditFormValues {
  name: string;
  description: string;
  colour: string;
}

export const ProjectEditForm = () => {
  const { values, errors, touched, handleChange, handleBlur } = useFormikContext<ProjectEditFormValues>();

  return (
    <>
      <TextField
        fullWidth
        id="name"
        name="name"
        label="Name"
        value={values.name}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.name && Boolean(errors.name)}
        helperText={touched.name && errors.name}
        margin="normal"
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
        helperText={touched.description && errors.description}
        margin="normal"
        multiline
        rows={3}
      />
      <TextField
        fullWidth
        id="colour"
        name="colour"
        label="Colour"
        value={values.colour}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.colour && Boolean(errors.colour)}
        helperText={touched.colour && errors.colour ? errors.colour : 'Hex code, e.g. #1a5a96'}
        margin="normal"
        inputProps={{ maxLength: 7 }}
      />
    </>
  );
};
