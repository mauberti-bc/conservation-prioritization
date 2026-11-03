import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { PmtilesLegendRow as PmtilesLegendRowDefinition } from 'utils/pmtiles-legend.interface';

interface PmtilesLegendRowProps {
  row: PmtilesLegendRowDefinition;
}

/**
 * Renders one PMTiles legend swatch row with optional range labels.
 *
 * @param {PmtilesLegendRowProps} props Component properties.
 * @returns {JSX.Element} The rendered component.
 */
export const PmtilesLegendRow = ({ row }: PmtilesLegendRowProps) => {
  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1}>
        <Box
          sx={{
            width: row.label ? 32 : '100%',
            height: 12,
            borderRadius: 0.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: row.color,
            background: row.gradient,
            flex: '0 0 auto',
          }}
        />
        {row.label ? <Typography variant="body2">{row.label}</Typography> : null}
      </Box>
      {row.startLabel && row.endLabel ? (
        <Box display="flex" justifyContent="space-between" sx={{ pl: row.label ? 5 : 0, mt: 0.25 }}>
          <Typography variant="caption" color="text.secondary">
            {row.startLabel}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.endLabel}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
};
