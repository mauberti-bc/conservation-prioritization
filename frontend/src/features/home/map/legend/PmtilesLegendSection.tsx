import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PmtilesLegendDefinition } from 'utils/pmtiles-legend.interface';
import { PmtilesLegendRow } from './PmtilesLegendRow';

interface PmtilesLegendSectionProps {
  definition: PmtilesLegendDefinition;
}

/**
 * Renders one titled PMTiles legend definition.
 *
 * @param {PmtilesLegendSectionProps} props
 * @returns {JSX.Element}
 */
export const PmtilesLegendSection = ({ definition }: PmtilesLegendSectionProps) => {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        {definition.title}
      </Typography>
      <Stack spacing={0.75}>
        {definition.rows.map((row, index) => (
          <PmtilesLegendRow key={row.label ?? index} row={row} />
        ))}
      </Stack>
    </Box>
  );
};
