import { Box, Card, CardContent, Checkbox, Chip, Stack, Typography } from '@mui/material';
import { TaskLayerOption } from 'features/home/task/create/form/layer/task-layer.interface';
import { getRandomHexColor } from 'utils/util';

interface LayerCardItemProps {
  layer: TaskLayerOption;
  checked: boolean;
  onToggle?: () => void;
  showCheckbox?: boolean;
}

export const LayerCardItem = ({ layer, checked, onToggle, showCheckbox = true }: LayerCardItemProps) => {
  const chips = layer.group.split('/');

  return (
    <Stack direction="row" gap={1} alignItems="flex-start" flex="1 1 auto">
      {showCheckbox && <Checkbox checked={checked} onChange={onToggle} color="primary" sx={{ mt: 1.5 }} />}
      <Card
        variant="outlined"
        sx={{
          flex: '1 1 auto',
          boxShadow: 'none',
          borderColor: 'divider',
        }}>
        <CardContent
          sx={{ p: 2, cursor: onToggle ? 'pointer' : 'default' }}
          onClick={() => {
            if (onToggle) {
              onToggle();
            }
          }}>
          <Stack spacing={1}>
            <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
              <Typography fontWeight={700}>{layer.name}</Typography>
              {!!chips.length && (
                <Stack direction="row" spacing={0.5}>
                  {chips.map((chip) => (
                    <Chip
                      key={chip}
                      label={chip}
                      size="small"
                      sx={{
                        minWidth: 0,
                        bgcolor: getRandomHexColor(chip),
                        color: 'white',
                        userSelect: 'none',
                      }}
                    />
                  ))}
                </Stack>
              )}
            </Box>
            {layer.description && (
              <Typography variant="body2" color="text.secondary">
                {layer.description}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};
