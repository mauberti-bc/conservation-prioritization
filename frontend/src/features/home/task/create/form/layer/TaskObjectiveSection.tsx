import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { LayerSearch } from 'features/layer/search/LayerSearch';
import { useFormikContext } from 'formik';
import { useMemo } from 'react';
import { TaskCreateFormValues } from '../TaskCreateForm';
import { LayerCardList } from './card/LayerCardList';
import { ObjectiveItem } from './card/ObjectiveItem';
import { initialTaskObjectiveValues, TaskLayerOption, TaskObjectiveConfig } from './optimization-form.interface';

interface TaskObjectiveSectionProps {
  isReadOnly?: boolean;
  autoSearchOnMount?: boolean;
}

/** Author objectives explicitly as layer, direction, and nonnegative importance. */
export const TaskObjectiveSection = ({ isReadOnly = false, autoSearchOnMount = false }: TaskObjectiveSectionProps) => {
  const { values, setFieldValue } = useFormikContext<TaskCreateFormValues>();
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

  const deleteObjective = (deleted: TaskObjectiveConfig) => {
    setFieldValue(
      'objectives',
      values.objectives.filter((value) => value.path !== deleted.path)
    );
  };

  return (
    <Stack gap={2}>
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
      <LayerCardList isEmpty={values.objectives.length === 0 && isReadOnly} emptyLabel="No objectives">
        {values.objectives.map((objective) => (
          <Box component="li" key={objective.path}>
            <ObjectiveItem
              objective={objective}
              onChange={updateObjective}
              onDelete={deleteObjective}
              isReadOnly={isReadOnly}
            />
          </Box>
        ))}
      </LayerCardList>
    </Stack>
  );
};
