/** Scientific aggregation semantics owned by one immutable source layer version. */
export interface LayerRepresentationContract {
  schema_version: 1;
  layer_id: string;
  contract_version: string;
  evidence_resolution: number;
  native_resolution: number;
  native_crs: string;
  native_transform: [number, number, number, number, number, number] | null;
  native_shape: [number, number] | null;
  data_kind: 'amount' | 'density' | 'probability' | 'binary' | 'categorical' | 'cost';
  units: string | null;
  valid_range: [number, number] | null;
  nodata_semantics: string;
  zero_semantics: string;
  aggregation_method: 'sum' | 'area_weighted_mean' | 'median' | 'maximum' | 'minimum' | 'any' | 'fraction' | 'mode';
  aggregation_parameters: Record<string, unknown>;
  extensive_or_intensive: 'extensive' | 'intensive' | 'categorical';
  coarse_to_fine_policy: 'prohibit' | 'nearest_constant' | 'overlap_constant' | 'domain_method';
  mapping_contract_version: string;
  compatibility_mode?: 'legacy_noncanonical';
}
