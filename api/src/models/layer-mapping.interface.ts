/** Pre-dispatch classification of one native layer onto a planning grid. */
export interface LayerMappingClassification {
  layer_id: string;
  method: 'direct' | 'nested_aggregate' | 'bounded_reproject' | 'coarse_to_fine_supported' | 'unsupported';
  native_resolution: number;
  planning_unit_resolution: number;
  reason_code: string;
}
