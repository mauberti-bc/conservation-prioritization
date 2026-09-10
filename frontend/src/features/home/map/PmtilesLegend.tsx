import Box from '@mui/material/Box';
import { TASK_TYPE } from 'hooks/interfaces/useTaskApi.interface';
import { PmtilesLegendContent } from './legend/PmtilesLegendContent';
import { usePmtilesLegendDefinitions } from './legend/usePmtilesLegendDefinitions';

interface PmtilesLegendProps {
  pmtilesUrls: string[];
  taskType?: TASK_TYPE | null;
}

/**
 * Displays the legend that corresponds to currently rendered PMTiles outputs.
 *
 * @param {PmtilesLegendProps} props
 * @returns {JSX.Element | null}
 */
export const PmtilesLegend = ({ pmtilesUrls, taskType }: PmtilesLegendProps) => {
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
    </Box>
  );
};
