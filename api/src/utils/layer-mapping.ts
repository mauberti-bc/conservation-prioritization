import { LayerRepresentationContract } from '../models/layer-contract.interface';
import { LayerMappingClassification } from '../models/layer-mapping.interface';

const EPSILON = 1e-7;

/**
 * Classifies a native layer mapping before workflow dispatch.
 *
 * @param {LayerRepresentationContract} contract Native layer semantics and affine metadata.
 * @param {number} planningResolution Destination planning-cell size in metres.
 * @param {[number, number, number, number, number, number] | null} planningTransform Grid-family GDAL transform.
 * @param {string} planningCrs Destination CRS.
 * @returns {LayerMappingClassification} Deterministic compatibility classification.
 */
export function classifyLayerMapping(
  contract: LayerRepresentationContract,
  planningResolution: number,
  planningTransform: [number, number, number, number, number, number] | null,
  planningCrs: string
): LayerMappingClassification {
  if (contract.native_crs !== planningCrs) {
    return {
      layer_id: contract.layer_id,
      method: 'bounded_reproject',
      native_resolution: contract.native_resolution,
      planning_unit_resolution: planningResolution,
      reason_code: 'cross_crs_requires_runtime_mapping'
    };
  }
  if (contract.native_resolution > planningResolution) {
    const supported = ['nearest_constant', 'overlap_constant'].includes(contract.coarse_to_fine_policy);
    return {
      layer_id: contract.layer_id,
      method: supported ? 'coarse_to_fine_supported' : 'unsupported',
      native_resolution: contract.native_resolution,
      planning_unit_resolution: planningResolution,
      reason_code: supported ? 'explicit_coarse_to_fine_policy' : 'coarse_to_fine_prohibited'
    };
  }
  if (!contract.native_transform || !planningTransform) {
    return {
      layer_id: contract.layer_id,
      method: 'bounded_reproject',
      native_resolution: contract.native_resolution,
      planning_unit_resolution: planningResolution,
      reason_code: 'affine_or_crs_requires_runtime_mapping'
    };
  }
  const ratio = planningResolution / contract.native_resolution;
  const roundedRatio = Math.round(ratio);
  const source = contract.native_transform;
  const destination = planningTransform;
  const axisAligned =
    Math.abs(source[2]) <= EPSILON &&
    Math.abs(source[4]) <= EPSILON &&
    Math.abs(destination[2]) <= EPSILON &&
    Math.abs(destination[4]) <= EPSILON;
  const aligned =
    Math.abs((destination[0] - source[0]) / source[1] - Math.round((destination[0] - source[0]) / source[1])) <=
      EPSILON &&
    Math.abs((destination[3] - source[3]) / source[5] - Math.round((destination[3] - source[3]) / source[5])) <=
      EPSILON;
  const integerRatio = Math.abs(ratio - roundedRatio) <= EPSILON;
  if (axisAligned && aligned && integerRatio) {
    return {
      layer_id: contract.layer_id,
      method: roundedRatio === 1 ? 'direct' : 'nested_aggregate',
      native_resolution: contract.native_resolution,
      planning_unit_resolution: planningResolution,
      reason_code: roundedRatio === 1 ? 'identical_affine_grid' : 'affine_proven_nested_grid'
    };
  }
  return {
    layer_id: contract.layer_id,
    method: 'bounded_reproject',
    native_resolution: contract.native_resolution,
    planning_unit_resolution: planningResolution,
    reason_code: 'non_nested_or_shifted_affine_grid'
  };
}
