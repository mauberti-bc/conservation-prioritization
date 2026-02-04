import { Box, TextField, InputAdornment } from '@mui/material';
import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { grey } from '@mui/material/colors';
import { useEffect, useState } from 'react';
import { useLayerSearch } from 'hooks/useLayerSearch';
import { TaskLayerOption } from 'features/home/task/create/form/layer/task-layer.interface';
import { LayerOptionAutocomplete } from './select/LayerOptionAutocomplete';

export type LayerSearchVariant = 'select' | 'list';

export interface LayerSearchRenderState {
  layers: TaskLayerOption[];
  loading: boolean;
  error: string | null;
}

interface LayerSearchProps {
  /**
   * Determines which UI to render.
   * `select` renders the autocomplete selection UI.
   * `list` renders a simple text input and calls `renderResults`.
   */
  variant?: LayerSearchVariant;
  selectedLayers?: TaskLayerOption[];
  onLayerChange?: (layer: TaskLayerOption) => void;
  showCheckbox?: boolean;
  renderResults?: (state: LayerSearchRenderState) => React.ReactNode;
  placeholder?: string;
  debounceMs?: number;
  allowEmptySearch?: boolean;
  autoSearchOnMount?: boolean;
  initialSearchTerm?: string;
}

/**
 * Canonical entry point for searching layers.
 * Owns the layer search UI and delegates data fetching to `useLayerSearch`.
 */
export const LayerSearch = ({
  variant = 'select',
  selectedLayers = [],
  onLayerChange,
  showCheckbox = false,
  renderResults,
  placeholder,
  debounceMs = 300,
  allowEmptySearch = false,
  autoSearchOnMount = false,
  initialSearchTerm = '',
}: LayerSearchProps) => {
  const [inputValue, setInputValue] = useState('');
  const { layers, loading, error, search } = useLayerSearch({ debounceMs, allowEmptySearch });

  useEffect(() => {
    if (!autoSearchOnMount) {
      return;
    }

    setInputValue(initialSearchTerm);
    search(initialSearchTerm);
  }, [autoSearchOnMount, initialSearchTerm, search]);

  if (variant === 'list') {
    return (
      <Box display="flex" flexDirection="column" gap={2} height="100%">
        <TextField
          value={inputValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            setInputValue(nextValue);
            search(nextValue);
          }}
          variant="outlined"
          fullWidth
          placeholder={placeholder ?? 'Type to search layers'}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Icon path={mdiMagnify} size={1} style={{ color: grey[500] }} />
                </InputAdornment>
              ),
            },
          }}
        />
        {renderResults?.({ layers, loading, error }) ?? null}
      </Box>
    );
  }

  if (!onLayerChange) {
    throw new Error('LayerSearch: onLayerChange is required when variant="select".');
  }

  return (
    <LayerOptionAutocomplete
      availableLayers={layers}
      loading={loading}
      error={error}
      onSearch={search}
      selectedLayers={selectedLayers}
      onLayerChange={onLayerChange}
      showCheckbox={showCheckbox}
    />
  );
};
