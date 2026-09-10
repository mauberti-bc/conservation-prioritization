import Stack from '@mui/material/Stack';
import { PmtilesLegendDefinition } from 'utils/pmtiles-legend.interface';
import { PmtilesLegendSection } from './PmtilesLegendSection';

interface PmtilesLegendContentProps {
  definitions: PmtilesLegendDefinition[];
}

/**
 * Renders the list of PMTiles legend sections.
 *
 * @param {PmtilesLegendContentProps} props
 * @returns {JSX.Element}
 */
export const PmtilesLegendContent = ({ definitions }: PmtilesLegendContentProps) => {
  return (
    <Stack spacing={1.5}>
      {definitions.map((definition) => (
        <PmtilesLegendSection key={definition.key} definition={definition} />
      ))}
    </Stack>
  );
};
