import { Box, Typography } from '@mui/material';
import Autocomplete, { AutocompleteProps, AutocompleteValue } from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { SyntheticEvent } from 'react';

interface Option {
  label: string | number;
  value: string | number;
  description?: string;
}

interface CustomAutocompleteProps<
  T extends Option,
  Multiple extends boolean = false,
  DisableClearable extends boolean = false,
> extends Partial<AutocompleteProps<T, Multiple, DisableClearable, boolean, 'div'>> {
  options: T[];
  value?: AutocompleteValue<T, Multiple, DisableClearable, boolean>;
  handleSelect?: (value: AutocompleteValue<T, Multiple, DisableClearable, false>) => void;
  label?: string;
  width?: number | string;
}

export const CustomAutocomplete = <
  T extends Option,
  Multiple extends boolean = false,
  DisableClearable extends boolean = false,
>({
  options,
  value,
  handleSelect,
  label,
  width = 300,
  ...autocompleteProps
}: CustomAutocompleteProps<T, Multiple, DisableClearable>) => {
  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_: SyntheticEvent, newValue: AutocompleteValue<T, Multiple, DisableClearable, false>) => {
        if (newValue && handleSelect) {
          handleSelect(newValue);
        }
      }}
      getOptionLabel={(option) => (typeof option === 'string' ? option : String(option.label))}
      isOptionEqualToValue={(option, val) => option.value === val.value}
      renderOption={(props, option) => (
        <Box
          component="li"
          {...props}
          key={option.value}
          sx={{
            '& li': {
              alignItems: 'flex-start',
            },
          }}>
          <Box flex="1 1 auto">
            <Typography fontWeight={700}>{option.label}</Typography>
            {option.description && (
              <Typography variant="body2" color="text.secondary">
                {option.description}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      renderInput={(params) => <TextField {...params} variant="outlined" size="small" label={label} />}
      sx={{ width, ...autocompleteProps.sx }}
      {...autocompleteProps}
    />
  );
};
