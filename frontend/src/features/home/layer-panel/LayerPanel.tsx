import { Box, Checkbox, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { SearchZarr } from '../search/SearchZarr';
import { LayerCards } from './cards/LayerCards';

export const LayerPanel = () => {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <SearchZarr>
      {(filteredLayerOptions) => (
        <Stack spacing={0} height="100%">
          {filteredLayerOptions.length > 0 && (
            <>
              <Box display="flex" alignItems="center" my={1}>
                <Checkbox
                  onChange={() =>
                    setSelected((prev) =>
                      prev.length < filteredLayerOptions.length ? filteredLayerOptions.map((l) => l.name) : []
                    )
                  }
                  indeterminate={selected.length > 0 && selected.length < filteredLayerOptions.length}
                  checked={selected.length === filteredLayerOptions.length}
                />
                <Typography
                  ml={3}
                  color="textSecondary"
                  fontWeight={700}
                  textTransform="uppercase"
                  letterSpacing={0.5}
                  variant="body2">
                  Layers ({filteredLayerOptions.length})
                </Typography>
              </Box>

              <Box display="flex" flexWrap="wrap" gap={2} sx={{ overflowY: 'auto', maxHeight: '100%' }}>
                <LayerCards layers={filteredLayerOptions} />
              </Box>
            </>
          )}
        </Stack>
      )}
    </SearchZarr>
  );
};
