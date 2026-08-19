import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { LayerSearch } from 'features/layer/search/LayerSearch';
import { useFormikContext } from 'formik';
import { TaskCreateFormValues } from '../TaskCreateForm';
import { ConstraintItem } from '../layer/card/ConstraintItem';
import { LayerCardList } from '../layer/card/LayerCardList';
import { TaskConstraintConfig, TaskLayerOption } from '../layer/optimization-form.interface';

interface Props {
  isReadOnly?: boolean;
  autoSearchOnMount?: boolean;
}

/** Author aggregate and per-planning-unit constraints independently of objectives. */
export const TaskConstraintSection = ({ isReadOnly = false, autoSearchOnMount = false }: Props) => {
  const { values, setFieldValue } = useFormikContext<TaskCreateFormValues>();

  const deleteConstraint = (deleted: TaskConstraintConfig) => {
    setFieldValue(
      'constraints',
      values.constraints.filter((constraint) => constraint.id !== deleted.id)
    );
  };

  const updateConstraint = (updated: TaskConstraintConfig) => {
    setFieldValue(
      'constraints',
      values.constraints.map((constraint) => (constraint.id === updated.id ? updated : constraint))
    );
  };

  return (
    <Stack gap={2}>
      {!isReadOnly && (
        <LayerSearch
          variant="select"
          showCheckbox
          selectedLayers={values.constraints.map((constraint) => ({
            path: constraint.layer,
            name: constraint.name ?? constraint.layer,
            group: constraint.layer.split('/').slice(0, -1).join('/'),
          }))}
          allowEmptySearch
          autoSearchOnMount={autoSearchOnMount}
          initialSearchTerm=""
          onLayerChange={(layer: TaskLayerOption) => {
            const existing = values.constraints.find((constraint) => constraint.layer === layer.path);
            setFieldValue(
              'constraints',
              existing
                ? values.constraints.filter((constraint) => constraint.layer !== layer.path)
                : [
                    ...values.constraints,
                    {
                      id: crypto.randomUUID(),
                      name: layer.name,
                      type: 'aggregate',
                      layer: layer.path,
                      min: null,
                      max: null,
                    },
                  ]
            );
          }}
        />
      )}
      <LayerCardList isEmpty={values.constraints.length === 0 && isReadOnly}>
        {values.constraints.map((constraint) => (
          <Box component="li" key={constraint.id}>
            <ConstraintItem
              constraint={constraint}
              onChange={updateConstraint}
              onDelete={deleteConstraint}
              isReadOnly={isReadOnly}
            />
          </Box>
        ))}
      </LayerCardList>
    </Stack>
  );
};
