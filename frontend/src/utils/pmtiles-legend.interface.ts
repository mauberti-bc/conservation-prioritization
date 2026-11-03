export type PmtilesSurface = 'decision' | 'allocation' | 'priority';

export interface PmtilesLegendEntry {
  surface: PmtilesSurface;
  colorRamp: string | null;
}

export interface PmtilesLegendDefinition {
  key: string;
  title: string;
  rows: PmtilesLegendRow[];
}

export interface PmtilesLegendRow {
  label?: string;
  color?: string;
  gradient?: string;
  startLabel?: string;
  endLabel?: string;
}
