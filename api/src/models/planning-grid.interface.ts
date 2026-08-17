/** Immutable definition of one level in a regular planning-grid family. */
export interface PlanningGridDefinition {
  [key: string]: unknown;
  type: 'regular_grid';
  grid_family_id: string;
  grid_family_version: number;
  grid_level: number;
  crs: 'EPSG:3005';
  planning_unit_resolution: number;
  base_cell_size: number;
  scale_factor: number;
  origin: [number, number];
  transform: [number, number, number, number, number, number] | null;
  extent: unknown;
  source_shape: unknown;
  row_orientation: 'north_to_south';
  cell_id_encoding: 'row_major_uint64_v1';
  aoi_inclusion_rule: 'cell_center_v1';
  mask_lineage: string;
  lineage: Record<string, unknown>;
}
