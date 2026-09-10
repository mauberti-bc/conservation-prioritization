import { PmtilesLegendRow, PmtilesSurface } from 'utils/pmtiles-legend.interface';

export const PMTILES_SURFACES: PmtilesSurface[] = ['decision', 'allocation', 'priority'];

export const DEFAULT_PMTILES_LEGEND_COLOR_RAMP = 'default';

export const PMTILES_LEGEND_TITLES: Record<PmtilesSurface, string> = {
  allocation: 'Continuous allocation',
  priority: 'Priority',
  decision: 'Discrete selection',
};

export const PMTILES_LEGEND_ROWS: Record<PmtilesSurface, PmtilesLegendRow[]> = {
  allocation: [
    {
      gradient: 'linear-gradient(90deg, #440154 0%, #31688e 35%, #35b779 70%, #fde725 100%)',
      startLabel: 'Low',
      endLabel: 'High',
    },
  ],
  priority: [
    {
      gradient: 'linear-gradient(90deg, #000004 0%, #721f81 35%, #f1605d 70%, #fcfdbf 100%)',
      startLabel: 'Low',
      endLabel: 'High',
    },
  ],
  decision: [
    {
      label: 'Selected',
      color: 'rgba(154, 217, 60, 0.86)',
    },
    {
      label: 'Considered',
      color: 'rgba(160, 160, 160, 0.7)',
    },
  ],
};
