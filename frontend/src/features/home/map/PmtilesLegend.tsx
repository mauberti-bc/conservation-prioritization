import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { PmtilesLegendContent } from './legend/PmtilesLegendContent';
import { usePmtilesLegendDefinitions } from './legend/usePmtilesLegendDefinitions';
import { PmtilesLegendProps } from './PmtilesLegend.interface';

/**
 * Displays the current PMTiles legend and a slider controlling task-layer opacity.
 *
 * @param {PmtilesLegendProps} props Output URLs, task type, current opacity, and the opacity change callback.
 * @returns {JSX.Element | null} The rendered component.
 */
export const PmtilesLegend = ({ pmtilesUrls, taskType, opacity, onOpacityChange }: PmtilesLegendProps) => {
  const definitions = usePmtilesLegendDefinitions(pmtilesUrls, taskType);

  if (definitions.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        right: 32,
        bottom: 48,
        zIndex: 10,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        boxShadow: 3,
        p: 1.5,
        minWidth: 220,
        maxWidth: 280,
      }}>
      <PmtilesLegendContent definitions={definitions} />
      <Box mt={1.5}>
        <Typography variant="body2">Opacity: {Math.round(opacity * 100)}%</Typography>
        <Slider
          aria-label="Task layer opacity"
          min={0}
          max={100}
          step={1}
          value={Math.round(opacity * 100)}
          onChange={(_, value) => onOpacityChange((value as number) / 100)}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}%`}
        />
      </Box>
    </Box>
  );
};
