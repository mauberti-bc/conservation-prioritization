import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { grey } from '@mui/material/colors';
import TextField from '@mui/material/TextField';

interface LayerPanelTextFieldProps {
  value: string;
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LayerPanelTextField = ({ value, handleChange }: LayerPanelTextFieldProps) => {
  return (
    <TextField
      value={value}
      onChange={handleChange}
      variant="outlined"
      fullWidth
      slotProps={{
        input: {
          startAdornment: <Icon path={mdiMagnify} size={1} style={{ marginRight: 8, color: grey[500] }} />,
        },
      }}
      placeholder="Type to search layers"
    />
  );
};
