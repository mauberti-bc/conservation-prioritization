import { Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { LayerSearch } from 'features/layer/search/LayerSearch';
import { useFormikContext } from 'formik';
import { TaskCreateFormValues } from '../TaskCreateForm';
import { TaskLayerOption } from '../layer/optimization-form.interface';

interface Props {
  isReadOnly?: boolean;
  autoSearchOnMount?: boolean;
}

/** Author aggregate and per-planning-unit constraints independently of objectives. */
export const TaskConstraintSection = ({ isReadOnly = false, autoSearchOnMount = false }: Props) => {
  const { values, setFieldValue } = useFormikContext<TaskCreateFormValues>();
  return (
    <Stack gap={2}>
      {!isReadOnly && (
        <LayerSearch
          variant="select"
          showCheckbox
          selectedLayers={values.constraints.map((constraint) => ({
            path: constraint.layer,
            name: constraint.layer,
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
                    { id: crypto.randomUUID(), type: 'aggregate', layer: layer.path, min: null, max: null },
                  ]
            );
          }}
        />
      )}
      {values.constraints.map((constraint, index) => (
        <Box key={constraint.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
          <Typography fontWeight={600} mb={1}>
            {constraint.layer}
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField
              select
              label="Constraint type"
              value={constraint.type}
              disabled={isReadOnly}
              onChange={(event) => setFieldValue(`constraints[${index}].type`, event.target.value)}>
              <MenuItem value="aggregate">Solution total</MenuItem>
              <MenuItem value="planning_unit">Each planning unit</MenuItem>
            </TextField>
            <TextField
              type="number"
              label="Minimum"
              value={constraint.min ?? ''}
              disabled={isReadOnly}
              onChange={(event) =>
                setFieldValue(
                  `constraints[${index}].min`,
                  event.target.value === '' ? null : Number(event.target.value)
                )
              }
            />
            <TextField
              type="number"
              label="Maximum"
              value={constraint.max ?? ''}
              disabled={isReadOnly}
              onChange={(event) =>
                setFieldValue(
                  `constraints[${index}].max`,
                  event.target.value === '' ? null : Number(event.target.value)
                )
              }
            />
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};
