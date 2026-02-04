import { mdiCancel, mdiLockCheck, mdiPlusLock, mdiTuneVariant } from '@mdi/js';
import Icon from '@mdi/react';
import {
  alpha,
  Box,
  Checkbox,
  Collapse,
  IconButton,
  ListItem,
  Paper,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { TooltipStack } from 'components/tooltip/TooltipStack';
import { TooltipPopover } from 'components/TooltipPopover';
import { useEffect, useState } from 'react';
import { appTheme } from 'theme/AppTheme';
import { FormikErrorAlert } from '../../error/FormikErrorAlert';
import { TaskLayerConfig, TaskLayerMode } from '../task-layer.interface';
import { LayerConstraints } from './constraint/LayerConstraints';

interface Props {
  layer: TaskLayerConfig;
  checked: boolean;
  onLayerChange: (layer: TaskLayerConfig, newLayer: TaskLayerConfig) => void;
  onModeChange: (layer: TaskLayerConfig, newMode: TaskLayerMode) => void;
  handleAddConstraint: (layer: TaskLayerConfig) => void;
  handleCheckboxChange: (layerName: string) => void;
  errors?: { id: string; message: string }[];
  handleErrorClose: (message: string) => void;
}

export const SelectedLayerItem = ({
  layer,
  checked,
  onLayerChange,
  onModeChange,
  handleAddConstraint,
  handleCheckboxChange,
  errors,
  handleErrorClose,
}: Props) => {
  const [localImportance, setLocalImportance] = useState(layer.importance);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const getTrackColor = (value: number) => {
    if (value === 0) {
      return appTheme.palette.primary.main;
    }
    return value < 0 ? appTheme.palette.error.light : appTheme.palette.success.light;
  };

  useEffect(() => {
    setLocalImportance(layer.importance);
  }, [layer.importance]);

  // Returns icon color inside the toggle buttons
  const getModeColor = (mode: TaskLayerMode, currentMode: TaskLayerMode, theme = appTheme) => {
    if (mode !== currentMode) {
      return grey[500];
    }

    switch (mode) {
      case 'flexible':
        return theme.palette.primary.main;
      case 'locked-in':
        return theme.palette.success.main;
      case 'locked-out':
        return theme.palette.error.main;
      default:
        return grey[500];
    }
  };

  // Returns sx for a selected toggle button based on theme color key
  const selectedModeSx = (themeKey: 'primary' | 'success' | 'error', theme = appTheme) => ({
    backgroundColor: 'transparent',
    '&.Mui-selected': {
      outlineColor: alpha(theme.palette[themeKey].main, 0.3),
      bgcolor: alpha(theme.palette[themeKey].main, 0.1),
      '&:hover': {
        bgcolor: alpha(theme.palette[themeKey].main, 0.15),
      },
    },
  });

  return (
    <Stack flexDirection="row" gap={1} id={`layer-item`}>
      <Box mt={1}>
        <Checkbox checked={checked} onChange={() => handleCheckboxChange(layer.name)} />
      </Box>

      <ListItem
        component={Paper}
        variant="outlined"
        sx={{
          px: 3,
          py: 1,
          border: `1px solid ${grey[200]} !important`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          mb: 2,
          rowGap: 1,
          minWidth: 0,
          overflow: 'visible',
        }}>
        {isMobile ? (
          // MOBILE LAYOUT
          <>
            {/* Row 1: Label and Buttons */}
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
              <TooltipPopover tooltip={layer.name}>
                <Typography
                  fontWeight={700}
                  whiteSpace="nowrap"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                  {layer.name}
                </Typography>
              </TooltipPopover>

              <Box display="flex" alignItems="center" gap={1}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={layer.mode}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(_, newMode) => {
                    if (newMode) {
                      onModeChange(layer, newMode);
                    }
                  }}
                  sx={{
                    gap: 1,
                    borderRadius: '4px',
                    display: 'flex',
                    '& .MuiToggleButton-root': {
                      borderRadius: '4px',
                      minWidth: 0,
                      '&:hover:not(.Mui-selected)': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      },
                    },
                  }}
                  aria-label="Lock mode">
                  {layer.mode !== 'flexible' && (
                    <TooltipPopover tooltip="Weigh the layer by importance">
                      <ToggleButton
                        value="flexible"
                        aria-label="Flexible"
                        sx={{
                          pl: 1.5,
                          justifyContent: 'center',
                          borderRadius: '4px',
                          position: 'relative',
                          '&.Mui-selected': {
                            backgroundColor: '#fff',
                            outline: 'none',
                            padding: '0 !important',
                            zIndex: 1,
                            '&:hover': {
                              backgroundColor: '#fff',
                            },
                          },
                        }}>
                        <Icon path={mdiTuneVariant} size={0.75} color={getModeColor('flexible', layer.mode)} />
                      </ToggleButton>
                    </TooltipPopover>
                  )}

                  <TooltipPopover tooltip="Always include areas above a threshold">
                    <ToggleButton value="locked-in" aria-label="Locked in" sx={selectedModeSx('success')}>
                      <Icon path={mdiLockCheck} size={0.8} color={getModeColor('locked-in', layer.mode)} />
                    </ToggleButton>
                  </TooltipPopover>

                  <TooltipPopover tooltip="Always exclude areas above a threshold">
                    <ToggleButton value="locked-out" aria-label="Locked out" sx={selectedModeSx('error')}>
                      <Icon path={mdiCancel} size={0.8} color={getModeColor('locked-out', layer.mode)} />
                    </ToggleButton>
                  </TooltipPopover>
                </ToggleButtonGroup>

                <TooltipPopover tooltip="Add constraint">
                  <IconButton
                    color="primary"
                    sx={{ borderRadius: '4px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddConstraint(layer);
                    }}
                    aria-label="Add Constraint">
                    <Icon path={mdiPlusLock} size={1} />
                  </IconButton>
                </TooltipPopover>
              </Box>
            </Box>

            {/* Row 2: Slider or Status Text */}
            <Box sx={{ width: '100%' }} display="flex" alignItems="center">
              {layer.mode === 'locked-in' && (
                <Typography variant="body2" color="textSecondary">
                  Included
                </Typography>
              )}
              {layer.mode === 'locked-out' && (
                <Typography variant="body2" color="textSecondary">
                  Excluded
                </Typography>
              )}
              {layer.mode === 'flexible' && (
                <TooltipStack
                  gap={3}
                  flexChildren
                  tooltip="Use the slider to adjust the relative influence of each layer.
        Layers with positive influence will be prioritized for conservation while negative layers will be avoided.">
                  <Slider
                    value={localImportance}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(_, value) => setLocalImportance(value as number)}
                    onChangeCommitted={(_, value) => onLayerChange(layer, { ...layer, importance: value })}
                    step={1}
                    min={-100}
                    max={100}
                    marks={[{ value: 0 }]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                    sx={{
                      width: '100%',
                      height: 10,
                      color: getTrackColor(localImportance ?? 0),
                      '& .MuiSlider-thumb': {
                        border: '2px solid white',
                      },
                    }}
                  />
                </TooltipStack>
              )}
            </Box>
          </>
        ) : (
          // DESKTOP LAYOUT
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              rowGap: 0,
              columnGap: 1,
              flexWrap: 'nowrap',
            }}
            aria-controls={`layer-content`}
            role="button"
            tabIndex={0}>
            {/* Layer Name */}
            <Box
              sx={{
                flex: '0 0 150px',
                minWidth: 0,
                display: 'flex',
                justifyContent: 'flex-start',
              }}>
              <TooltipPopover tooltip={layer.name}>
                <Typography
                  fontWeight={700}
                  whiteSpace="nowrap"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                  {layer.name}
                </Typography>
              </TooltipPopover>
            </Box>

            {/* Slider + Buttons Container - wraps on larger screens */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flex: '1 1 auto',
                minWidth: 0,
                flexWrap: 'wrap',
              }}>
              {/* Left-side: Included/Excluded or Slider */}
              <Box sx={{ flexShrink: 0 }} display="flex" alignItems="center">
                {layer.mode === 'locked-in' && (
                  <Typography variant="body2" color="textSecondary">
                    Included
                  </Typography>
                )}
                {layer.mode === 'locked-out' && (
                  <Typography variant="body2" color="textSecondary">
                    Excluded
                  </Typography>
                )}
                {layer.mode === 'flexible' && (
                  <Slider
                    value={localImportance}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(_, value) => setLocalImportance(value as number)}
                    onChangeCommitted={(_, value) => onLayerChange(layer, { ...layer, importance: value })}
                    step={1}
                    min={-100}
                    max={100}
                    marks={[{ value: 0 }]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                    sx={{
                      width: 160,
                      height: 10,
                      color: getTrackColor(localImportance ?? 0),
                      '& .MuiSlider-thumb': {
                        border: '2px solid white',
                      },
                    }}
                  />
                )}
              </Box>

              {/* Right-side: Buttons + Add constraint */}
              <Box display="flex" alignItems="center" gap={1}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={layer.mode}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(_, newMode) => {
                    if (newMode) {
                      onModeChange(layer, newMode);
                    }
                  }}
                  sx={{
                    gap: 1,
                    borderRadius: '4px',
                    display: 'flex',
                    '& .MuiToggleButton-root': {
                      borderRadius: '4px',
                      minWidth: 0,
                      '&:hover:not(.Mui-selected)': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      },
                    },
                  }}
                  aria-label="Lock mode">
                  {layer.mode !== 'flexible' && (
                    <TooltipPopover tooltip="Weigh the layer by importance">
                      <ToggleButton
                        value="flexible"
                        aria-label="Flexible"
                        sx={{
                          pl: 1.5,
                          justifyContent: 'center',
                          borderRadius: '4px',
                          position: 'relative',
                          '&.Mui-selected': {
                            backgroundColor: '#fff',
                            outline: 'none',
                            padding: '0 !important',
                            zIndex: 1,
                            '&:hover': {
                              backgroundColor: '#fff',
                            },
                          },
                        }}>
                        <Icon path={mdiTuneVariant} size={0.75} color={getModeColor('flexible', layer.mode)} />
                      </ToggleButton>
                    </TooltipPopover>
                  )}

                  <TooltipPopover tooltip="Always include areas above a threshold">
                    <ToggleButton value="locked-in" aria-label="Locked in" sx={selectedModeSx('success')}>
                      <Icon path={mdiLockCheck} size={0.8} color={getModeColor('locked-in', layer.mode)} />
                    </ToggleButton>
                  </TooltipPopover>

                  <TooltipPopover tooltip="Always exclude areas above a threshold">
                    <ToggleButton value="locked-out" aria-label="Locked out" sx={selectedModeSx('error')}>
                      <Icon path={mdiCancel} size={0.8} color={getModeColor('locked-out', layer.mode)} />
                    </ToggleButton>
                  </TooltipPopover>
                </ToggleButtonGroup>

                <TooltipPopover tooltip="Add constraint">
                  <IconButton
                    color="primary"
                    sx={{ borderRadius: '4px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddConstraint(layer);
                    }}
                    aria-label="Add Constraint">
                    <Icon path={mdiPlusLock} size={1} />
                  </IconButton>
                </TooltipPopover>
              </Box>
            </Box>
          </Box>
        )}

        <Collapse in={layer.constraints.length > 0} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
          <Box mt={2} mb={1}>
            <LayerConstraints layer={layer} onLayerChange={onLayerChange} />
          </Box>
        </Collapse>

        {/* ERROR BANNER */}
        {errors && errors.length > 0 && (
          <Box mt={2} width="100%">
            <FormikErrorAlert errors={errors ?? []} onClose={handleErrorClose} />
          </Box>
        )}
      </ListItem>
    </Stack>
  );
};
