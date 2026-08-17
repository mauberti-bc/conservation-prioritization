import { Checkbox, IconButton, List, Stack, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { mdiBroom } from '@mdi/js';
import Icon from '@mdi/react';
import { LayerSearch } from 'features/layer/search/LayerSearch';
import { useFormikContext } from 'formik';
import { useMemo, useState } from 'react';
import { TaskCreateFormValues } from '../TaskCreateForm';
import { ObjectiveItem } from './card/ObjectiveItem';
import { initialTaskObjectiveValues, TaskLayerOption, TaskObjectiveConfig } from './optimization-form.interface';

interface TaskObjectiveSectionProps {
  isReadOnly?: boolean;
  autoSearchOnMount?: boolean;
}

/** Author objectives explicitly as layer, direction, and nonnegative importance. */
export const TaskObjectiveSection = ({ isReadOnly = false, autoSearchOnMount = false }: TaskObjectiveSectionProps) => {
  const { values, setFieldValue } = useFormikContext<TaskCreateFormValues>();
  const [selected, setSelected] = useState<string[]>([]);
  const selectedOptions = useMemo<TaskLayerOption[]>(
    () =>
      values.objectives.map((objective) => ({
        path: objective.path,
        name: objective.name,
        group: objective.path.split('/').slice(0, -1).join('/'),
      })),
    [values.objectives]
  );

  const updateObjective = (updated: TaskObjectiveConfig) => {
    setFieldValue(
      'objectives',
      values.objectives.map((value) => (value.path === updated.path ? updated : value))
    );
  };

  return (
    <Stack gap={1}>
      {!isReadOnly && (
        <LayerSearch
          variant="select"
          showCheckbox
          selectedLayers={selectedOptions}
          allowEmptySearch
          autoSearchOnMount={autoSearchOnMount}
          initialSearchTerm=""
          onLayerChange={(layer: TaskLayerOption) => {
            const exists = values.objectives.some((objective) => objective.path === layer.path);
            setFieldValue(
              'objectives',
              exists
                ? values.objectives.filter((objective) => objective.path !== layer.path)
                : [...values.objectives, { ...initialTaskObjectiveValues, ...layer }]
            );
          }}
        />
      )}
      {values.objectives.length > 0 && (
        <>
          <Stack direction="row" alignItems="center">
            {!isReadOnly && (
              <Checkbox
                checked={selected.length === values.objectives.length}
                indeterminate={selected.length > 0 && selected.length < values.objectives.length}
                onChange={() =>
                  setSelected(selected.length === values.objectives.length ? [] : values.objectives.map((v) => v.name))
                }
              />
            )}
            <Typography fontWeight={700} color="text.secondary">
              Objectives ({values.objectives.length})
            </Typography>
            {!isReadOnly && (
              <IconButton
                sx={{ ml: 'auto' }}
                onClick={() => {
                  const removing = selected.length ? selected : values.objectives.map((value) => value.name);
                  setFieldValue(
                    'objectives',
                    values.objectives.filter((value) => !removing.includes(value.name))
                  );
                  setSelected([]);
                }}>
                <Icon path={mdiBroom} size={1} />
              </IconButton>
            )}
          </Stack>
          <List disablePadding>
            {values.objectives.map((objective) => (
              <ObjectiveItem
                key={objective.path}
                objective={objective}
                checked={selected.includes(objective.name)}
                onChange={updateObjective}
                onCheckboxChange={(name) =>
                  setSelected((current) =>
                    current.includes(name) ? current.filter((value) => value !== name) : [...current, name]
                  )
                }
                isReadOnly={isReadOnly}
              />
            ))}
          </List>
        </>
      )}
      {values.objectives.length === 0 && isReadOnly && (
        <Box>
          <Typography color="text.secondary">No objectives</Typography>
        </Box>
      )}
    </Stack>
  );
};
