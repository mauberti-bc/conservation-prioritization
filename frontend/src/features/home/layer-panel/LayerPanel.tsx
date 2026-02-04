import { Checkbox, Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';
import { useLayerSearch } from 'hooks/useLayerSearch';
import { useState } from 'react';
import { LayerCardItem } from './card/LayerCardItem';
import { LayerPanelTextField } from './search/LayerPanelTextField';

export const LayerPanel = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');

  // Call the new useLayerSearch hook
  const { filtered, handleSearch } = useLayerSearch({ debounceMs: 300 });

  return (
    <Stack spacing={0} height="100%">
      {/* Show search input */}
      <LayerPanelTextField
        value={searchInput}
        handleChange={(e) => {
          setSearchInput(e.target.value);
          handleSearch(e.target.value);
        }}
      />

      {/* Display layers if they are available */}
      {filtered.length > 0 && (
        <>
          <Box display="flex" alignItems="center" my={1}>
            <Checkbox
              onChange={() => setSelected((prev) => (prev.length < filtered.length ? filtered.map((l) => l.name) : []))}
              indeterminate={selected.length > 0 && selected.length < filtered.length}
              checked={selected.length === filtered.length}
            />
            <Typography
              ml={3}
              color="textSecondary"
              fontWeight={700}
              textTransform="uppercase"
              letterSpacing={0.5}
              variant="body2">
              Layers ({filtered.length})
            </Typography>
          </Box>

          <Box display="flex" flexWrap="wrap" gap={2} sx={{ overflowY: 'auto', maxHeight: '100%' }}>
            {filtered.map((layer) => (
              <LayerCardItem layer={layer} checked={false} />
            ))}
          </Box>
        </>
      )}
    </Stack>
  );
};
