import { mdiDeleteOutline } from '@mdi/js';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { IconMenuItem } from 'components/button/IconMenuButton';
import { TaskConstraintConfig } from '../optimization-form.interface';
import { LayerCard } from './LayerCard';

interface Props {
  constraint: TaskConstraintConfig;
  onChange: (constraint: TaskConstraintConfig) => void;
  onDelete: (constraint: TaskConstraintConfig) => void;
  isReadOnly?: boolean;
}

/**
 * Edit one constraint as type and optional numeric bounds.
 *
 * @param {Props} props Component properties.
 * @returns {React.ReactNode} The rendered component.
 */
export const ConstraintItem = ({ constraint, onChange, onDelete, isReadOnly = false }: Props) => {
  const menuItems: IconMenuItem[] = [
    {
      label: 'Delete',
      icon: mdiDeleteOutline,
      color: 'error',
      onClick: () => {
        onDelete(constraint);
      },
    },
  ];

  return (
    <LayerCard title={constraint.name ?? constraint.layer} menuOptions={isReadOnly ? [] : menuItems}>
      <Stack direction="row" gap={1.5} alignItems="center">
        <TextField
          select
          label="Constraint"
          value={constraint.type}
          disabled={isReadOnly}
          onChange={(event) => {
            onChange({ ...constraint, type: event.target.value as TaskConstraintConfig['type'] });
          }}
          sx={{ flex: '1 1 160px', minWidth: 120 }}>
          <MenuItem value="aggregate">Total</MenuItem>
          <MenuItem value="planning_unit">Each</MenuItem>
        </TextField>
        <TextField
          type="number"
          label="Min"
          value={constraint.min ?? ''}
          disabled={isReadOnly}
          onChange={(event) => {
            onChange({ ...constraint, min: event.target.value === '' ? null : Number(event.target.value) });
          }}
          sx={{ width: { xs: 92, sm: 120 } }}
        />
        <TextField
          type="number"
          label="Max"
          value={constraint.max ?? ''}
          disabled={isReadOnly}
          onChange={(event) => {
            onChange({ ...constraint, max: event.target.value === '' ? null : Number(event.target.value) });
          }}
          sx={{ width: { xs: 92, sm: 120 } }}
        />
      </Stack>
    </LayerCard>
  );
};
