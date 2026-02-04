import { mdiArrowExpand } from '@mdi/js';
import Icon from '@mdi/react';
import { Autocomplete, IconButton } from '@mui/material';
import { useLayerSelectContext } from 'context/layerSelectContext';
import { FormValues } from 'features/home/control-panel/ControlPanel';
import { LayerOption } from 'features/home/control-panel/form/ControlPanelForm';
import { useFormikContext } from 'formik';
import { useState } from 'react';
import { LayerSearchDialog } from '../../dialog/LayerSearchDialog';
import { LayerOptionItem } from '../render/LayerOptionItem';
import { LayerSearchInput } from './input/LayerSearchInput';

const MAX_VISIBLE_FILTERS = 2;

interface ILayerOptionAutocompleteProps {
  checkbox: boolean;
}

export const LayerOptionAutocomplete = (props: ILayerOptionAutocompleteProps) => {
  const { checkbox } = props;

  const [dialogOpen, setDialogOpen] = useState(false);

  const { values } = useFormikContext<FormValues>();
  const { filteredLayers, handleChange, groupFilters, setGroupFilters, inputValue, setInputValue } =
    useLayerSelectContext();

  return (
    <>
      <Autocomplete
        multiple
        filterSelectedOptions
        disableCloseOnSelect
        disableClearable
        clearOnBlur={false}
        inputValue={inputValue}
        options={filteredLayers}
        getOptionLabel={(option) => option.name}
        onInputChange={(_, value) => {
          setInputValue(value);
        }}
        renderInput={(params) => (
          <LayerSearchInput
            {...params}
            filters={groupFilters}
            onRemoveFilter={(filter) => setGroupFilters((prev) => prev.filter((f) => f !== filter))}
            onBackspaceEmptyInput={() => {
              setGroupFilters((prev) => prev.slice(0, -1));
            }}
            maxVisibleFilters={MAX_VISIBLE_FILTERS}
            onRemoveExtraFilters={(filters) =>
              setGroupFilters((prev) => [
                ...prev.slice(0, MAX_VISIBLE_FILTERS),
                ...prev.slice(MAX_VISIBLE_FILTERS).filter((f) => !filters.includes(f)),
              ])
            }
            customEndAdornment={
              <IconButton
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setDialogOpen(true);
                }}
                size="small"
                sx={{ mr: 1, p: 1, fontSize: '0.75rem' }}>
                <Icon path={mdiArrowExpand} size={0.75} />
              </IconButton>
            }
          />
        )}
        renderOption={(props, option: LayerOption) => (
          <LayerOptionItem
            key={option.name}
            option={option}
            props={props}
            checkbox={checkbox}
            isChecked={values.layers.some((layer) => layer.path === option.path)}
            handleClick={() => handleChange(option)}
          />
        )}
        slotProps={{
          paper: {
            sx: {
              maxHeight: '60vh',
              overflowY: 'auto',
            },
          },
          popper: {
            sx: {
              maxHeight: '60vh',
            },
          },
          listbox: {
            sx: {
              maxHeight: '60vh',
            },
          },
        }}
      />

      <LayerSearchDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
};
