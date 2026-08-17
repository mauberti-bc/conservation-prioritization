import { Box, Checkbox, ListItem, Slider, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { TaskObjectiveConfig } from '../optimization-form.interface';

interface Props {
  objective: TaskObjectiveConfig;
  checked: boolean;
  onChange: (objective: TaskObjectiveConfig) => void;
  onCheckboxChange: (name: string) => void;
  isReadOnly?: boolean;
}

/** Edit one explicit objective without mixing in constraint or lock semantics. */
export const ObjectiveItem = ({ objective, checked, onChange, onCheckboxChange, isReadOnly = false }: Props) => {
  return (
    <ListItem disableGutters sx={{ py: 1 }}>
      {!isReadOnly && <Checkbox checked={checked} onChange={() => onCheckboxChange(objective.name)} />}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'center' }} width="100%">
        <Box minWidth={220}>
          <Typography fontWeight={600}>{objective.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {objective.path}
          </Typography>
        </Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={objective.direction}
          disabled={isReadOnly}
          onChange={(_, direction: TaskObjectiveConfig['direction'] | null) => {
            if (direction) {
              onChange({ ...objective, direction });
            }
          }}>
          <ToggleButton value="maximize">Maximize</ToggleButton>
          <ToggleButton value="minimize">Minimize</ToggleButton>
        </ToggleButtonGroup>
        <Box flex={1} minWidth={180}>
          <Typography variant="caption">Relative importance: {objective.importance}</Typography>
          <Slider
            min={0}
            max={100}
            value={objective.importance}
            disabled={isReadOnly}
            onChange={(_, importance) => onChange({ ...objective, importance: importance as number })}
          />
        </Box>
      </Stack>
    </ListItem>
  );
};
