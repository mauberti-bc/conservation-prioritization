import { mdiBroom, mdiClose, mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { useLayerSelectContext } from 'context/layerSelectContext';
import { LayerCardItem } from 'features/home/layer-panel/card/LayerCardItem';
import { useFormikContext } from 'formik';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createInputValueAndDetectFiltersHandler, doesLayerMatchFilters } from 'utils/filter-match';
import { pluralize } from 'utils/util';
import { LayerSearchLayout } from './layout/LayerSearchLayout';
import { TaskCreateFormValues } from '../../TaskCreateForm';

interface LayerSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export const LayerSearchDialog = ({ open, onClose }: LayerSearchDialogProps) => {
  const { values } = useFormikContext<TaskCreateFormValues>();
  const {
    availableLayers,
    handleChange,
    groupFilters: contextGroupFilters,
    inputValue: contextInputValue,
  } = useLayerSelectContext();

  const [groupFilters, setGroupFilters] = useState<string[]>(contextGroupFilters);
  const [inputValue, setInputValue] = useState<string>(contextInputValue);

  useEffect(() => {
    setGroupFilters(contextGroupFilters);
  }, [contextGroupFilters]);

  useEffect(() => {
    setInputValue(contextInputValue);
  }, [contextInputValue]);

  const handleInputChange = useCallback(
    (input: string) => {
      return createInputValueAndDetectFiltersHandler(availableLayers, setInputValue, setGroupFilters)(input);
    },
    [availableLayers, setInputValue, setGroupFilters]
  );

  const filteredLayers = useMemo(() => {
    return availableLayers.filter((layer) => doesLayerMatchFilters(layer, inputValue, groupFilters));
  }, [availableLayers, inputValue, groupFilters]);

  const hasResults = filteredLayers.length > 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" sx={{ '& .MuiPaper-root': { px: 0, m: 0 } }}>
      <DialogTitle
        sx={{
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <>
          Layers
          <IconButton onClick={onClose}>
            <Icon path={mdiClose} size={1} />
          </IconButton>
        </>
      </DialogTitle>

      <DialogContent sx={{ p: '0 24px 0 0 !important' }}>
        <Box
          sx={{
            pb: 2,
            pl: 3,
            borderBottom: `1px solid ${grey[200]}`,
            gap: 1,
            display: 'flex',
            justifyContent: 'space-between',
          }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search layers"
            value={inputValue}
            onChange={(e) => {
              handleInputChange(e.currentTarget.value);
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Icon path={mdiMagnify} size={1} style={{ color: grey[500] }} />
                      {groupFilters.map((filter) => (
                        <Chip
                          key={filter}
                          label={filter}
                          size="small"
                          sx={{ minWidth: 0 }}
                          onDelete={() => setGroupFilters(groupFilters.filter((existing) => existing !== filter))}
                        />
                      ))}
                    </Stack>
                  </InputAdornment>
                ),
                endAdornment: (inputValue || groupFilters.length > 0) && (
                  <InputAdornment position="start">
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <IconButton
                        onClick={() => {
                          setGroupFilters([]);
                          setInputValue('');
                        }}>
                        <Icon path={mdiBroom} size={1} style={{ color: grey[500] }} />
                      </IconButton>
                    </Stack>
                  </InputAdornment>
                ),
              },
              htmlInput: {
                onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Backspace' && e.currentTarget.value === '') {
                    setGroupFilters((prev) => prev.slice(0, -1));
                  }
                },
              },
            }}
          />
        </Box>

        {/* Layer List */}
        <LayerSearchLayout
          groupFilters={groupFilters}
          setGroupFilters={(filter: string) =>
            setGroupFilters((prev) => (prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]))
          }>
          <List sx={{ pl: 1 }}>
            {hasResults ? (
              filteredLayers.map((layer) => (
                <ListItem key={layer.path} sx={{ px: 0 }}>
                  <LayerCardItem
                    layer={layer}
                    onToggle={() => handleChange(layer)}
                    checked={values.layers.some((l) => l.path === layer.path)}
                  />
                </ListItem>
              ))
            ) : (
              <Box
                sx={{
                  px: 3,
                  pt: 4,
                  pb: 4,
                  textAlign: 'center',
                  color: 'text.secondary',
                  backgroundColor: (theme) => theme.palette.action.hover,
                  borderRadius: 1,
                  mx: 2,
                }}>
                <Typography gutterBottom>
                  No options for{' '}
                  <Typography component="span" fontWeight={700} fontStyle="italic">
                    {inputValue || '""'}
                  </Typography>
                  {groupFilters.length > 0 && (
                    <>
                      {' '}
                      with {pluralize('filter', groupFilters.length)}{' '}
                      <Typography component="span" fontWeight={700} fontStyle="italic">
                        {groupFilters.join(', ')}
                      </Typography>
                    </>
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Try adjusting your search or filters.
                </Typography>
              </Box>
            )}
          </List>
        </LayerSearchLayout>
      </DialogContent>
    </Dialog>
  );
};
