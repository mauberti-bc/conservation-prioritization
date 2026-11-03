import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { AutocompleteRenderInputParams, Chip, InputAdornment, Stack, TextField } from '@mui/material';
import { grey } from '@mui/material/colors';
import React from 'react';

interface LayerSearchInputProps extends AutocompleteRenderInputParams {
  filters?: string[];
  onRemoveFilter?: (filter: string) => void;
  onRemoveExtraFilters?: (filters: string[]) => void;
  onBackspaceEmptyInput?: () => void;
  customEndAdornment?: React.ReactNode;
  maxVisibleFilters: number;
}

export const LayerSearchInput = ({
  filters = [],
  onRemoveFilter,
  onRemoveExtraFilters,
  onBackspaceEmptyInput,
  customEndAdornment,
  maxVisibleFilters,
  InputProps,
  inputProps,
  ...rest
}: LayerSearchInputProps) => {
  const visibleFilters = filters.slice(0, maxVisibleFilters);
  const extraFilters = filters.slice(maxVisibleFilters);

  return (
    <TextField
      {...rest}
      variant="outlined"
      placeholder="Search layers"
      slotProps={{
        input: {
          ...InputProps,
          startAdornment: (
            <InputAdornment position="start">
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Icon path={mdiMagnify} size={1} style={{ color: grey[500] }} />
                {visibleFilters.map((filter) => (
                  <Chip
                    key={filter}
                    label={filter}
                    sx={{ minWidth: 0 }}
                    size="small"
                    onDelete={onRemoveFilter ? () => onRemoveFilter(filter) : undefined}
                  />
                ))}
                {extraFilters.length > 0 && (
                  <Chip
                    label={`+${extraFilters.length}`}
                    sx={{ minWidth: 0 }}
                    size="small"
                    onDelete={onRemoveExtraFilters ? () => onRemoveExtraFilters(extraFilters) : undefined}
                  />
                )}
              </Stack>
            </InputAdornment>
          ),
          endAdornment: customEndAdornment,
        },
        htmlInput: {
          ...inputProps,
          onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Backspace' && e.currentTarget.value === '') {
              onBackspaceEmptyInput?.();
            }
            inputProps?.onKeyDown?.(e);
          },
        },
      }}
    />
  );
};
