import { Checkbox, Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TaskLayerOption } from 'features/home/task/create/form/layer/task-layer.interface';
import { useLayerSelectionContext } from 'hooks/useContext';
import { LayerCardItem } from './card/LayerCardItem';

interface LayerPanelProps {
  layers: TaskLayerOption[];
  isLoading: boolean;
  error: string | null;
}

export const LayerPanel = ({ layers, isLoading, error }: LayerPanelProps) => {
  const { selectedLayers, setSelectedLayers } = useLayerSelectionContext();
  const selectedNames = new Set(selectedLayers.map((layer) => layer.name));

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
                onChange={() => {
                  if (selectedLayers.length < layers.length) {
                    setSelectedLayers(layers);
                  } else {
                    setSelectedLayers([]);
                  }
                }}
                indeterminate={selectedLayers.length > 0 && selectedLayers.length < layers.length}
                checked={selectedLayers.length === layers.length}
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
                <LayerCardItem
                  key={layer.path}
                  layer={layer}
                  checked={selectedNames.has(layer.name)}
                  onToggle={() => {
                    const exists = selectedLayers.some((item) => item.path === layer.path);
                    if (exists) {
                      setSelectedLayers(selectedLayers.filter((item) => item.path !== layer.path));
                      return;
                    }
                    setSelectedLayers([...selectedLayers, layer]);
                  }}
                />
              ))}
            </Box>
          </>
        )}
      </LoadingGuard>
    </Stack>
  );
};
