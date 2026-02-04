import { mdiArrowExpand } from '@mdi/js';
import Icon from '@mdi/react';
import { Autocomplete, IconButton } from '@mui/material';
import { TaskLayerOption } from 'features/home/task/create/form/layer/task-layer.interface';
import { useState } from 'react';
import { LayerSearchDialog } from '../dialog/LayerSearchDialog';
import { LayerSearchInput } from './autocomplete/input/LayerSearchInput';
import { LayerOptionItem } from './render/LayerOptionItem';

const MAX_VISIBLE_FILTERS = 2;

interface LayerOptionAutocompleteProps {
  availableLayers: TaskLayerOption[];
  loading: boolean;
  error: string | null;
  onSearch: (term: string) => void;
  selectedLayers: TaskLayerOption[];
  onLayerChange: (layer: TaskLayerOption) => void;
  showCheckbox?: boolean;
}

/**
 * Autocomplete component for searching and selecting layers via API.
 * Handles layer search, selection, and expanded dialog view.
 */
export const LayerOptionAutocomplete = ({
  availableLayers,
  loading,
  error,
  onSearch,
  selectedLayers,
  onLayerChange,
  showCheckbox = false,
}: LayerOptionAutocompleteProps) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filter out already selected layers from suggestions
  const filteredOptions = availableLayers.filter(
    (layer) => !selectedLayers.some((selected) => selected.path === layer.path)
  );

  const handleSelectLayer = (layer: TaskLayerOption) => {
    onLayerChange(layer);
    setInputValue('');
  };

  const handleRemoveFilter = (filter: string) => {
    setSelectedFilters((prev) => prev.filter((f) => f !== filter));
  };

  const handleBackspaceOnEmpty = () => {
    setSelectedFilters((prev) => prev.slice(0, -1));
  };

  const handleRemoveExtraFilters = (filtersToRemove: string[]) => {
    setSelectedFilters((prev) => [
      ...prev.slice(0, MAX_VISIBLE_FILTERS),
      ...prev.slice(MAX_VISIBLE_FILTERS).filter((f) => !filtersToRemove.includes(f)),
    ]);
  };

  return (
    <>
      <Autocomplete
        multiple
        filterSelectedOptions
        disableCloseOnSelect
        disableClearable
        clearOnBlur={false}
        inputValue={inputValue}
        loading={loading}
        options={filteredOptions}
        getOptionLabel={(option) => option.name}
        onInputChange={(_, value) => {
          setInputValue(value);
          onSearch(value);
        }}
        onChange={(_, value) => {
          if (value.length > selectedLayers.length) {
            const newLayer = value[value.length - 1];
            handleSelectLayer(newLayer);
          }
        }}
        renderInput={(params) => (
          <LayerSearchInput
            {...params}
            filters={selectedFilters}
            onRemoveFilter={handleRemoveFilter}
            onBackspaceEmptyInput={handleBackspaceOnEmpty}
            maxVisibleFilters={MAX_VISIBLE_FILTERS}
            onRemoveExtraFilters={handleRemoveExtraFilters}
            customEndAdornment={
              <IconButton
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setDialogOpen(true);
                }}
                size="small"
                sx={{ mr: 1, p: 1 }}
                title="Expand layer search">
                <Icon path={mdiArrowExpand} size={0.75} />
              </IconButton>
            }
          />
        )}
        renderOption={(props, option: TaskLayerOption) => (
          <LayerOptionItem
            {...props}
            key={option.path}
            option={option}
            showCheckbox={showCheckbox}
            isChecked={selectedLayers.some((l) => l.path === option.path)}
            onSelect={handleSelectLayer}
          />
        )}
        slotProps={{
          paper: { sx: { maxHeight: '60vh' } },
          popper: { sx: { maxHeight: '60vh' } },
          listbox: { sx: { maxHeight: '60vh' } },
        }}
      />

      <LayerSearchDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        availableLayers={availableLayers}
        loading={loading}
        error={error}
        onSearch={onSearch}
        selectedLayers={selectedLayers}
        onLayerChange={onLayerChange}
      />
    </>
  );
};
