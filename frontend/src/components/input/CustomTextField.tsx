import TextField, { TextFieldProps } from '@mui/material/TextField';

type CustomTextFieldProps = Partial<TextFieldProps> & {
  label?: string;
  width?: number | string;
};

export const CustomTextField = ({ label, width = 300, ...textFieldProps }: CustomTextFieldProps) => {
  return (
    <TextField
      variant="outlined"
      size="small"
      label={label}
      sx={{
        width,
        '& .MuiInputBase-input': {
          textAlign: 'center',
          pl: '8px !important',
        },
        '& .MuiInputBase-input::placeholder': {
          textAlign: 'center',
        },
        ...textFieldProps.sx,
      }}
      {...textFieldProps}
    />
  );
};
