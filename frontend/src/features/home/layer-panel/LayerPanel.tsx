import { Checkbox, Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useState } from 'react';
import { TaskLayerOption } from 'features/home/task/create/form/layer/task-layer.interface';
import { LayerCardItem } from './card/LayerCardItem';

interface LayerPanelProps {
  layers: TaskLayerOption[];
  isLoading: boolean;
  error: string | null;
}

export const LayerPanel = ({ layers, isLoading, error }: LayerPanelProps) => {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <Stack spacing={0} height="100%" minHeight={0}>
      <LoadingGuard
        isLoading={isLoading}
        isLoadingFallback={<Typography color="textSecondary">Loading layers...</Typography>}
        hasNoData={!isLoading && layers.length === 0 && !error}
        hasNoDataFallback={<Typography color="textSecondary">No layers available</Typography>}>
        {error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <>
            <Box display="flex" alignItems="center" my={1}>
              <Checkbox
                onChange={() => setSelected((prev) => (prev.length < layers.length ? layers.map((l) => l.name) : []))}
                indeterminate={selected.length > 0 && selected.length < layers.length}
                checked={selected.length === layers.length}
              />
              <Typography
                ml={3}
                color="textSecondary"
                fontWeight={700}
                textTransform="uppercase"
                letterSpacing={0.5}
                variant="body2">
                Layers ({layers.length})
              </Typography>
            </Box>

            <Box display="flex" flexWrap="wrap" gap={2} sx={{ overflowY: 'auto', maxHeight: '100%' }}>
              {layers.map((layer) => (
                <LayerCardItem key={layer.path} layer={layer} checked={selected.includes(layer.name)} />
              ))}
            </Box>
          </>
        )}
      </LoadingGuard>
    </Stack>
  );
};
