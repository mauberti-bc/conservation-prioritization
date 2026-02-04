import { mdiArrowExpand } from '@mdi/js';
import Icon from '@mdi/react';
import { Autocomplete, IconButton } from '@mui/material';
import { LayerOption } from 'features/home/control-panel/form/ControlPanelForm';
import { useLayerSearch } from 'hooks/useLayerSearch';
import { useState } from 'react';
import { LayerSearchDialog } from '../../dialog/LayerSearchDialog';
import { LayerOptionItem } from '../render/LayerOptionItem';
import { LayerSearchInput } from './input/LayerSearchInput';

const MAX_VISIBLE_FILTERS = 2;

interface LayerOptionAutocompleteProps {
  selectedLayers: LayerOption[];
  onLayerChange: (layer: LayerOption) => void;
  showCheckbox?: boolean;
}

/**
 * Autocomplete component for searching and selecting layers via API.
 * Handles layer search, selection, and expanded dialog view.
 */
export const LayerOptionAutocomplete = ({
  selectedLayers,
  onLayerChange,
  showCheckbox = false,
}: LayerOptionAutocompleteProps) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<LayerOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { layers, loading, error, search } = useLayerSearch({ debounceMs: 300 });

  // Filter out already selected layers from suggestions
  const availableLayers = layers.filter((layer) => !selectedLayers.some((selected) => selected.path === layer.path));

  const handleSelectLayer = (layer: LayerOption) => {
    onLayerChange(layer);
    setInputValue('');
  };

  const handleRemoveFilter = (filter: LayerOption) => {
    setSelectedFilters((prev) => prev.filter((f) => f.path !== filter.path));
  };

  const handleBackspaceOnEmpty = () => {
    setSelectedFilters((prev) => prev.slice(0, -1));
  };

  const handleRemoveExtraFilters = (filtersToRemove: LayerOption[]) => {
    setSelectedFilters((prev) => [
      ...prev.slice(0, MAX_VISIBLE_FILTERS),
      ...prev.slice(MAX_VISIBLE_FILTERS).filter((f) => !filtersToRemove.some((remove) => remove.path === f.path)),
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
        options={availableLayers}
        getOptionLabel={(option) => option.name}
        onInputChange={(_, value) => {
          setInputValue(value);
          search(value);
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
            error={!!error}
            helperText={error}
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
        renderOption={(props, option: LayerOption) => (
          <LayerOptionItem
            key={option.path}
            {...props}
            option={option}
            showCheckbox={showCheckbox}
            isSelected={selectedLayers.some((l) => l.path === option.path)}
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
        selectedLayers={selectedLayers}
        onLayerChange={onLayerChange}
      />
    </>
  );
};
