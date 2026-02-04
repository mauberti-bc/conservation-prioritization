import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, IconButton, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { grey } from '@mui/material/colors';

export interface LayerConstraint {
  id: string;
  min: number | null;
  max: number | null;
  type: 'percent' | 'unit';
}

interface LayerConstraintProps {
  constraint: LayerConstraint;
  onChange: (updated: LayerConstraint) => void;
  onRemove: (constraint: LayerConstraint) => void;
}

export const LayerConstraint = ({ constraint, onChange, onRemove }: LayerConstraintProps) => {
  const handleValueChange = (type: 'min' | 'max', value: string) => {
    const parsed = parseFloat(value);
    const newVal = isNaN(parsed) ? null : parsed;

    const updatedConstraint: LayerConstraint = {
      ...constraint,
      [type]: newVal,
    };

    onChange(updatedConstraint);
  };

  const handleUnitChange = (_: unknown, newUnit: 'percent' | 'unit' | null) => {
    if (!newUnit) {
      return;
    }

    onChange({
      ...constraint,
      type: newUnit,
    });
  };

  return (
    <Box display="flex" flexDirection="column" gap={1} flex="1 1 auto">
      <Box display="flex" alignItems="center" gap={2} flex="1 1 auto">
        <TextField
          label="Min"
          fullWidth
          size="small"
          type="number"
          value={constraint.min ?? ''}
          onChange={(e) => handleValueChange('min', e.target.value)}
        />
        <TextField
          label="Max"
          fullWidth
          size="small"
          type="number"
          value={constraint.max ?? ''}
          onChange={(e) => handleValueChange('max', e.target.value)}
        />
        <ToggleButtonGroup
          exclusive
          value={constraint.type}
          onChange={handleUnitChange}
          size="small"
          color="primary"
          sx={{
            '& .MuiToggleButton-root': {
              borderRadius: '4px',
              padding: '8px 12px',
              minWidth: 0,
              opacity: 0.5,
            },
            '& .MuiToggleButton-root.Mui-selected': {
              opacity: 1,
            },
          }}>
          <ToggleButton value="unit">Unit</ToggleButton>
          <ToggleButton value="percent">%</ToggleButton>
        </ToggleButtonGroup>

        <IconButton onClick={() => onRemove(constraint)} sx={{ color: grey[400] }}>
          <Icon path={mdiTrashCanOutline} size={1} />
        </IconButton>
      </Box>
    </Box>
  );
};
