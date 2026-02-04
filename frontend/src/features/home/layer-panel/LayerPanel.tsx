import { Checkbox, Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';
import { useState } from 'react';
import { LayerSearch } from 'features/layer/search/LayerSearch';
import { LayerCardItem } from './card/LayerCardItem';

export const LayerPanel = () => {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <Stack spacing={0} height="100%">
      <LayerSearch
        variant="list"
        renderResults={({ layers }) =>
          layers.length > 0 ? (
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
          ) : null
        }
      />
    </Stack>
  );
};
