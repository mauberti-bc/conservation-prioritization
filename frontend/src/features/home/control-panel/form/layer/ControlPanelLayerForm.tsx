import { mdiBroom, mdiInformationSlabCircleOutline, mdiSync } from '@mdi/js';
import Icon from '@mdi/react';
import { Checkbox, IconButton, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import { TooltipPopover } from 'components/TooltipPopover';
import { useFormikContext } from 'formik';
import { useDialogContext } from 'hooks/useContext';
import { useCallback, useState } from 'react';
import { collectFormikErrorMessages } from 'utils/formik-error';
import { v4 } from 'uuid';
import { FormValues } from '../../ControlPanel';
import { LayerOption } from '../ControlPanelForm';
import { LayerConstraint } from './card/constraint/item/LayerConstraintItem';
import { SelectedLayerItem } from './card/SelectedLayerItem';
import { Layer, initialLayerValues } from './layer.interface';
import { LayerSelect } from './select/LayerSelect';

interface Props {
  layerOptions: LayerOption[];
}

export const ControlPanelLayerForm = ({ layerOptions }: Props) => {
  const { values, setFieldValue, errors, setFieldError } = useFormikContext<FormValues>();
  const [checkboxSelected, setCheckboxSelected] = useState<string[]>([]);
  const dialogContext = useDialogContext();

  const updateLayer = useCallback(
    (layer: Layer, newLayer: Layer) => {
      setFieldValue(
        'layers',
        values.layers.map((l) => (l.name === layer.name ? newLayer : l))
      );
    },
    [values.layers, setFieldValue]
  );

  const changeMode = (targetLayer: Layer, newMode: Layer['mode']) => {
    setFieldValue(
      'layers',
      values.layers.map((l) => (l.name === targetLayer.name ? { ...l, mode: newMode, importance: 0 } : l))
    );
  };

  const toggleCheckbox = (layerName: string) => {
    setCheckboxSelected((prev) =>
      prev.includes(layerName) ? prev.filter((name) => name !== layerName) : [...prev, layerName]
    );
  };

  const clearLayers = (layerNames?: string[]) => {
    const namesToRemove = layerNames ?? values.layers.map((l) => l.name);
    setFieldValue(
      'layers',
      values.layers.filter((l) => !namesToRemove.includes(l.name))
    );
    setCheckboxSelected((prev) => prev.filter((name) => !namesToRemove.includes(name)));
  };

  const resetLayers = (layerNames?: string[]) => {
    if (layerNames) {
      setFieldValue(
        'layers',
        values.layers.map((layer) =>
          layerNames?.includes(layer.name) ? { ...initialLayerValues, name: layer.name, path: layer.path } : layer
        )
      );
      return;
    }
    setFieldValue(
      'layers',
      values.layers.map((layer) => ({ ...initialLayerValues, name: layer.name, path: layer.path }))
    );
  };

  const handleCheckboxAll = () => {
    if (checkboxSelected.length < values.layers.length) {
      setCheckboxSelected(values.layers.map((layer) => layer.name));
      return;
    }
    setCheckboxSelected([]);
  };

  const handleAddConstraint = (layer: Layer) => {
    const newConstraint: LayerConstraint = {
      id: v4(),
      min: null,
      max: null,
      type: 'unit',
    };
    updateLayer(layer, { ...layer, constraints: [...layer.constraints, newConstraint] });
  };

  const handleClearAll = () => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: checkboxSelected.length > 0 ? 'Remove Selected Layers' : 'Remove Layers',
      dialogText: `Are you sure you want to remove ${checkboxSelected.length > 0 ? checkboxSelected.length : 'all'} layers?`,
      onClose: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onYes: () => {
        dialogContext.setYesNoDialog({ open: false });
        clearLayers(checkboxSelected.length > 0 ? checkboxSelected : undefined);
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
    });
  };

  const handleResetAll = () => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: checkboxSelected.length > 0 ? 'Reset Selected Layers' : 'Reset Layers',
      dialogText: `Are you sure you want to reset ${checkboxSelected.length > 0 ? checkboxSelected.length : 'all'} layers?`,
      onClose: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onYes: () => {
        dialogContext.setYesNoDialog({ open: false });
        resetLayers(checkboxSelected.length > 0 ? checkboxSelected : undefined);
      },
    });
  };

  return (
    <Stack direction="column" gap={1}>
      <Box>
        <LayerSelect
          checkbox
          selectedLayers={layerOptions.filter((option) => values.layers.some((layer) => layer.path === option.path))}
          availableLayers={layerOptions}
          handleChange={(selected: LayerOption) => {
            const isAlreadySelected = values.layers.some((layer) => layer.path === selected.path);

            if (isAlreadySelected) {
              // Remove it
              const updatedLayers = values.layers.filter((layer) => layer.path !== selected.path);
              setFieldValue('layers', updatedLayers);
            } else {
              // Add it
              const newLayer = { ...initialLayerValues, ...selected };
              setFieldValue('layers', [...values.layers, newLayer]);
            }
          }}
        />
      </Box>

      {values.layers.length > 0 ? (
        <>
          <Box display="flex" alignItems="center">
            <Checkbox
              onChange={handleCheckboxAll}
              indeterminate={checkboxSelected.length > 0 && checkboxSelected.length < values.layers.length}
              checked={checkboxSelected.length === values.layers.length}
            />
            <Typography
              ml={4}
              color="textSecondary"
              fontWeight={700}
              textTransform="uppercase"
              letterSpacing={0.5}
              variant="body2">
              Layers ({values.layers.length})
            </Typography>
            <TooltipPopover
              tooltip="Use the slider to adjust the relative influence of each layer on the result.
              Layers with positive influence will be prioritized for conservation while negative layers will be avoided.">
              <Typography
                ml={17.5}
                color="textSecondary"
                fontWeight={700}
                display="flex"
                alignItems="center"
                sx={{ cursor: 'pointer' }}
                textTransform="uppercase"
                letterSpacing={0.5}
                variant="body2">
                Influence
                <Icon
                  path={mdiInformationSlabCircleOutline}
                  size={0.95}
                  style={{ color: grey[500], marginLeft: '8px' }}
                />
              </Typography>
            </TooltipPopover>

            <Stack gap={0.5} flexDirection="row" ml="auto">
              <IconButton sx={{ color: grey[500] }} onClick={handleResetAll}>
                <Icon path={mdiSync} size={1} />
              </IconButton>
              <IconButton sx={{ color: grey[500] }} onClick={handleClearAll}>
                <Icon path={mdiBroom} size={1} />
              </IconButton>
            </Stack>
          </Box>

          <Box>
            <List disablePadding>
              {values.layers.map((layer, index) => {
                const errorObjects = collectFormikErrorMessages(errors.layers?.[index]);

                return (
                  <SelectedLayerItem
                    key={layer.name}
                    layer={layer}
                    onLayerChange={updateLayer}
                    onModeChange={changeMode}
                    handleCheckboxChange={toggleCheckbox}
                    handleAddConstraint={handleAddConstraint}
                    checked={checkboxSelected.includes(layer.name)}
                    errors={errorObjects}
                    handleErrorClose={(messageToRemove: string) => {
                      const updatedMessages = errorObjects.filter((error) => error.message !== messageToRemove);
                      setFieldError(
                        `layers[${index}]`,
                        updatedMessages.length > 0 ? updatedMessages[0].message : undefined
                      );
                    }}
                  />
                );
              })}
            </List>
          </Box>
        </>
      ) : null}
    </Stack>
  );
};
