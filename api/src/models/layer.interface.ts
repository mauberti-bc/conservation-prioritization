/**
 * Layer metadata structure parsed from a consolidated Zarr store.
 */
export interface LayerMeta {
  /** Parent grouping path, e.g. "landcover/disturbance" */
  group: string;
  /** Full array path, e.g. "landcover/disturbance/mining" */
  path: string;
  /** Display name for the layer */
  name: string;
  /** Optional description for the layer */
  description?: string;
  /** Array shape from Zarr metadata */
  shape: number[];
  /** Data type string from Zarr metadata */
  dtype: string;
  /** Native evidence resolution declared by the immutable source layer. */
  evidence_resolution?: number;
  /** Versioned scientific representation contract. */
  representation_contract?: Record<string, unknown>;
}
