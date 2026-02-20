import { Box, IconButton, InputAdornment, Popover, Stack, TextField, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { useFormikContext } from 'formik';
import { useRef, useState } from 'react';

export interface ProjectEditFormValues {
  name: string;
  description: string;
  colour: string;
}

export const ProjectEditForm = () => {
  const { values, errors, touched, handleChange, handleBlur, setFieldValue } =
    useFormikContext<ProjectEditFormValues>();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerAnchorRef = useRef<HTMLButtonElement | null>(null);
  const normalizedColour = values.colour.startsWith('#') ? values.colour : `#${values.colour}`;
  const isValidColour = /^#([0-9a-fA-F]{6})$/.test(normalizedColour);
  const colourPresets = ['#1A5A96', '#2E8540', '#D8292F', '#F9C642', '#3C3C3B', '#6B4E9B', '#00A3E0', '#C1440E'];

  const applyHexValue = (hex: string) => {
    const normalizedHex = hex.startsWith('#') ? hex.slice(1) : hex;
    void setFieldValue('colour', normalizedHex.toUpperCase());
  };

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
        placeholder="e.g. 1A5A96"
        value={values.colour}
        onChange={undefined}
        onBlur={handleBlur}
        error={touched.colour && Boolean(errors.colour)}
        helperText={touched.colour && errors.colour ? errors.colour : ''}
        margin="normal"
        slotProps={{
          input: {
            readOnly: true,
            sx: {
              pointerEvents: 'none',
              '& .MuiInputAdornment-positionEnd': {
                pointerEvents: 'auto',
              },
            },
            startAdornment: (
              <InputAdornment position="start">
                <Typography fontWeight={700}>#</Typography>
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  ref={pickerAnchorRef}
                  aria-label="Open colour picker"
                  size="small"
                  onClick={() => {
                    setIsPickerOpen(true);
                  }}>
                  <Box
                    sx={{
                      width: 35,
                      height: 35,
                      borderRadius: '4px',
                      border: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: isValidColour ? normalizedColour : grey[100],
                    }}
                  />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        inputProps={{ maxLength: 6 }}
      />
      <Popover
        open={isPickerOpen}
        anchorEl={pickerAnchorRef.current}
        onClose={() => {
          setIsPickerOpen(false);
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}>
        <Stack spacing={1.5} sx={{ p: 2, width: 240 }}>
          <TextField
            label="Hex"
            value={values.colour}
            onChange={(event) => {
              applyHexValue(event.target.value);
            }}
            size="small"
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start">#</InputAdornment>,
              },
            }}
            inputProps={{ maxLength: 6 }}
          />
          <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={1}>
            {colourPresets.map((preset) => {
              const isSelected = normalizedColour.toUpperCase() === preset;
              return (
                <IconButton
                  key={preset}
                  size="small"
                  onClick={() => {
                    applyHexValue(preset);
                  }}
                  sx={{
                    border: '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    borderRadius: '4px',
                    p: 0.25,
                  }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '2px', bgcolor: preset }} />
                </IconButton>
              );
            })}
          </Box>
        </Stack>
      </Popover>
    </>
  );
};
