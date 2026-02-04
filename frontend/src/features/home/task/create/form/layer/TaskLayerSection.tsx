import { mdiBroom, mdiInformationSlabCircleOutline, mdiSync } from '@mdi/js';
import Icon from '@mdi/react';
import { Checkbox, IconButton, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import { TooltipPopover } from 'components/TooltipPopover';
import { LayerSearch } from 'features/layer/search/LayerSearch';
import { useFormikContext } from 'formik';
import { useDialogContext } from 'hooks/useContext';
import { useCallback, useMemo, useState } from 'react';
import { collectFormikErrorMessages } from 'utils/formik-error';
import { v4 } from 'uuid';
import { FormikErrorAlert } from '../error/FormikErrorAlert';
import { TaskCreateFormValues } from '../TaskCreateForm';
import { LayerConstraint } from './card/constraint/item/LayerConstraintItem';
import { SelectedLayerItem } from './card/SelectedLayerItem';
import { TaskLayerConfig, TaskLayerOption, initialTaskLayerValues } from './task-layer.interface';

interface TaskLayerSectionProps {
  isReadOnly?: boolean;
}

export const TaskLayerSection = ({ isReadOnly = false }: TaskLayerSectionProps) => {
  const { values, setFieldValue, errors, setFieldError } = useFormikContext<TaskCreateFormValues>();
  const [checkboxSelected, setCheckboxSelected] = useState<string[]>([]);
  const dialogContext = useDialogContext();

  const selectedLayerOptions: TaskLayerOption[] = useMemo(
    () =>
      values.layers.map((layer) => ({
        path: layer.path,
        name: layer.name,
        description: undefined,
        group: layer.path.split('/').slice(0, -1).join('/'),
      })),
    [values.layers]
  );

  const updateLayer = useCallback(
    (layer: TaskLayerConfig, newLayer: TaskLayerConfig) => {
      setFieldValue(
        'layers',
        values.layers.map((l) => (l.name === layer.name ? newLayer : l))
      );
    },
    [values.layers, setFieldValue]
  );

  const changeMode = (targetLayer: TaskLayerConfig, newMode: TaskLayerConfig['mode']) => {
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
          layerNames.includes(layer.name) ? { ...initialTaskLayerValues, name: layer.name, path: layer.path } : layer
        )
      );
      return;
    }

    setFieldValue(
      'layers',
      values.layers.map((layer) => ({
        ...initialTaskLayerValues,
        name: layer.name,
        path: layer.path,
      }))
    );
  };

  const handleCheckboxAll = () => {
    if (checkboxSelected.length < values.layers.length) {
      setCheckboxSelected(values.layers.map((layer) => layer.name));
      return;
    }
    setCheckboxSelected([]);
  };

  const handleAddConstraint = (layer: TaskLayerConfig) => {
    const newConstraint: LayerConstraint = {
      id: v4(),
      min: null,
      max: null,
      type: 'unit',
    };

    updateLayer(layer, {
      ...layer,
      constraints: [...layer.constraints, newConstraint],
    });
  };

  const handleClearAll = () => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: checkboxSelected.length > 0 ? 'Remove Selected Layers' : 'Remove Layers',
      dialogText: `Are you sure you want to remove ${
        checkboxSelected.length > 0 ? checkboxSelected.length : 'all'
      } layers?`,
      onClose: () => dialogContext.setYesNoDialog({ open: false }),
      onNo: () => dialogContext.setYesNoDialog({ open: false }),
      onYes: () => {
        dialogContext.setYesNoDialog({ open: false });
        clearLayers(checkboxSelected.length > 0 ? checkboxSelected : undefined);
      },
    });
  };

  const handleResetAll = () => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: checkboxSelected.length > 0 ? 'Reset Selected Layers' : 'Reset Layers',
      dialogText: `Are you sure you want to reset ${
        checkboxSelected.length > 0 ? checkboxSelected.length : 'all'
      } layers?`,
      onClose: () => dialogContext.setYesNoDialog({ open: false }),
      onNo: () => dialogContext.setYesNoDialog({ open: false }),
      onYes: () => {
        dialogContext.setYesNoDialog({ open: false });
        resetLayers(checkboxSelected.length > 0 ? checkboxSelected : undefined);
      },
    });
  };

  const handleErrorClose = (messageToRemove: string, index?: number) => {
    if (index !== undefined) {
      const layerErrors = collectFormikErrorMessages(errors.layers?.[index]);
      const updated = layerErrors.filter((e) => e.message !== messageToRemove);

      setFieldError(`layers[${index}]`, updated.length > 0 ? updated[0].message : undefined);
      return;
    }

    if (!errors.layers) {
      return;
    }

    const errorObjects = collectFormikErrorMessages(errors.layers);
    const updated = errorObjects.filter((e) => e.message !== messageToRemove);

    setFieldError('layers', updated.length > 0 ? updated[0].message : undefined);
  };

  return (
    <Stack direction="column" gap={1}>
      {!isReadOnly && (
        <Box>
          <LayerSearch
            variant="select"
            showCheckbox
            selectedLayers={selectedLayerOptions}
            onLayerChange={(selected: TaskLayerOption) => {
              const exists = values.layers.some((layer) => layer.path === selected.path);

              if (exists) {
                setFieldValue(
                  'layers',
                  values.layers.filter((layer) => layer.path !== selected.path)
                );
              } else {
                setFieldValue('layers', [...values.layers, { ...initialTaskLayerValues, ...selected }]);
              }
            }}
          />
        </Box>
      )}

      {errors.layers && typeof errors.layers === 'string' && (
        <Box mt={2} width="100%">
          <FormikErrorAlert errors={[{ message: errors.layers as string }]} onClose={handleErrorClose} />
        </Box>
      )}

      {values.layers.length > 0 && (
        <>
          <Box display="flex" alignItems="center">
            {!isReadOnly && (
              <Checkbox
                onChange={handleCheckboxAll}
                indeterminate={checkboxSelected.length > 0 && checkboxSelected.length < values.layers.length}
                checked={checkboxSelected.length === values.layers.length}
              />
            )}

            <Stack direction="row" gap={1} alignItems="center">
              <Typography
                ml={isReadOnly ? 0 : 4}
                color="textSecondary"
                fontWeight={700}
                textTransform="uppercase"
                letterSpacing={0.5}
                variant="body2"
                width="150px"
                noWrap>
                Layers ({values.layers.length})
              </Typography>

              <Box sx={{ display: { xs: 'none', lg: 'flex' } }}>
                <TooltipPopover tooltip="Use the slider to adjust the relative influence of each layer.">
                  <Typography
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
                      style={{ color: grey[500], marginLeft: 8 }}
                    />
                  </Typography>
                </TooltipPopover>
              </Box>
            </Stack>

            <Stack direction="row" gap={0.5} ml="auto">
              {!isReadOnly && (
                <>
                  <IconButton sx={{ color: grey[500] }} onClick={handleResetAll}>
                    <Icon path={mdiSync} size={1} />
                  </IconButton>
                  <IconButton sx={{ color: grey[500] }} onClick={handleClearAll}>
                    <Icon path={mdiBroom} size={1} />
                  </IconButton>
                </>
              )}
            </Stack>
          </Box>

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
                  handleErrorClose={(message) => {
                    const updated = errorObjects.filter((e) => e.message !== message);
                    setFieldError(`layers[${index}]`, updated.length > 0 ? updated[0].message : undefined);
                  }}
                  isReadOnly={isReadOnly}
                />
              );
            })}
          </List>
        </>
      )}
    </Stack>
  );
};
