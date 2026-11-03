import { ApiGeneralError } from '../errors/api-error';
import { LayerRepresentationContract } from '../models/layer-contract.interface';

type LegacyLayerSemantics = Pick<
  LayerRepresentationContract,
  'data_kind' | 'aggregation_method' | 'aggregation_parameters' | 'extensive_or_intensive' | 'coarse_to_fine_policy'
>;

const LEGACY_LAYER_SEMANTICS: Record<string, LegacyLayerSemantics> = {
  'ecological/ecosystem_intactness/Ecosystem_Intactness': {
    data_kind: 'density',
    aggregation_method: 'area_weighted_mean',
    aggregation_parameters: {},
    extensive_or_intensive: 'intensive',
    coarse_to_fine_policy: 'nearest_constant'
  },
  'ecological/old_growth/Old_Growth_TAP_Old_Growth_Type': {
    data_kind: 'categorical',
    aggregation_method: 'mode',
    aggregation_parameters: { tie_rule: 'lowest_value' },
    extensive_or_intensive: 'categorical',
    coarse_to_fine_policy: 'nearest_constant'
  },
  'ecological/species/species_example_ranges': {
    data_kind: 'binary',
    aggregation_method: 'any',
    aggregation_parameters: {},
    extensive_or_intensive: 'intensive',
    coarse_to_fine_policy: 'nearest_constant'
  }
};

for (const layerName of [
  'any_protected_areas',
  'conservancy',
  'ecological_reserve',
  'heritage_site',
  'national_park',
  'protected_area',
  'provincial_park',
  'recreation_area',
  'regional_park'
]) {
  LEGACY_LAYER_SEMANTICS[`land_designations/${layerName}`] = {
    data_kind: 'binary',
    aggregation_method: 'any',
    aggregation_parameters: {},
    extensive_or_intensive: 'intensive',
    coarse_to_fine_policy: 'nearest_constant'
  };
}

for (const layerName of ['agriculture', 'any_human_disturbance', 'cut_blocks', 'mining', 'right_of_ways', 'urban']) {
  LEGACY_LAYER_SEMANTICS[`landcover/human_disturbance/${layerName}`] = {
    data_kind: 'binary',
    aggregation_method: 'any',
    aggregation_parameters: {},
    extensive_or_intensive: 'intensive',
    coarse_to_fine_policy: 'nearest_constant'
  };
}

/**
 * Resolves a source-owned layer contract and validates its minimum semantics.
 *
 * @param {string} layerId Full group/variable identifier.
 * @param {Record<string, unknown>} sourceMetadata Immutable analytical-source metadata.
 * @param {'mode' | 'minimum' | 'maximum'} legacyAggregationMethod Explicit legacy aggregation semantics.
 * @returns {LayerRepresentationContract} Validated representation contract.
 */
export function resolveLayerContract(
  layerId: string,
  sourceMetadata: Record<string, unknown>,
  legacyAggregationMethod?: 'mode' | 'minimum' | 'maximum'
): LayerRepresentationContract {
  const contracts = sourceMetadata.layer_contracts;
  if (!contracts || typeof contracts !== 'object' || Array.isArray(contracts)) {
    if (sourceMetadata.lineage === 'incomplete' && legacyAggregationMethod) {
      const isCategorical = legacyAggregationMethod === 'mode';
      const declaredSemantics = LEGACY_LAYER_SEMANTICS[layerId];
      return {
        schema_version: 1,
        layer_id: layerId,
        contract_version: 'legacy-explicit-v1',
        evidence_resolution: Number(sourceMetadata.base_resolution ?? 5000),
        native_resolution: Number(sourceMetadata.base_resolution ?? 5000),
        native_crs: String(sourceMetadata.crs ?? 'EPSG:3005'),
        native_transform: null,
        native_shape: null,
        data_kind: declaredSemantics?.data_kind ?? (isCategorical ? 'categorical' : 'density'),
        units: null,
        valid_range: null,
        nodata_semantics: 'excluded_from_planning_units',
        zero_semantics: 'valid_absence_or_zero',
        aggregation_method: declaredSemantics?.aggregation_method ?? legacyAggregationMethod,
        aggregation_parameters:
          declaredSemantics?.aggregation_parameters ?? (isCategorical ? { tie_rule: 'lowest_value' } : {}),
        extensive_or_intensive:
          declaredSemantics?.extensive_or_intensive ??
          (isCategorical ? 'categorical' : 'intensive'),
        // TODO: Move resampling and coarse-to-fine policy into authoritative per-layer
        // contracts based on each layer's units, quantity semantics, and data kind.
        coarse_to_fine_policy: declaredSemantics?.coarse_to_fine_policy ?? 'nearest_constant',
        mapping_contract_version: 'legacy-affine-observed-v1',
        compatibility_mode: 'legacy_noncanonical'
      };
    }
    throw new ApiGeneralError('The published analytical source does not declare layer representation contracts.', []);
  }
  const candidate = (contracts as Record<string, unknown>)[layerId];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new ApiGeneralError(`No representation contract is published for layer ${layerId}.`, []);
  }
  const contract = candidate as Partial<LayerRepresentationContract>;
  const descriptors = sourceMetadata.layer_descriptors;
  const descriptor =
    descriptors && typeof descriptors === 'object' && !Array.isArray(descriptors)
      ? (descriptors as Record<string, unknown>)[layerId]
      : null;
  const nativeDescriptor =
    descriptor && typeof descriptor === 'object' && !Array.isArray(descriptor)
      ? (descriptor as Record<string, unknown>)
      : {};
  const supportedKinds = ['amount', 'density', 'probability', 'binary', 'categorical', 'cost'];
  const supportedMethods = ['sum', 'area_weighted_mean', 'median', 'maximum', 'minimum', 'any', 'fraction', 'mode'];
  const evidenceResolution = Number(contract.evidence_resolution);
  const nativeResolution = Number(
    contract.native_resolution ?? nativeDescriptor.native_resolution ?? evidenceResolution
  );
  const nativeCrs = String(contract.native_crs ?? nativeDescriptor.crs ?? '');
  const nativeTransformCandidate = contract.native_transform ?? nativeDescriptor.transform;
  const nativeShapeCandidate =
    contract.native_shape ??
    (nativeDescriptor.height !== undefined && nativeDescriptor.width !== undefined
      ? [nativeDescriptor.height, nativeDescriptor.width]
      : null);
  const coarseToFinePolicy = contract.coarse_to_fine_policy ?? 'prohibit';
  if (
    !supportedKinds.includes(String(contract.data_kind)) ||
    !supportedMethods.includes(String(contract.aggregation_method)) ||
    !Number.isFinite(evidenceResolution) ||
    evidenceResolution <= 0 ||
    !Number.isFinite(nativeResolution) ||
    nativeResolution <= 0 ||
    !nativeCrs ||
    !contract.contract_version ||
    !contract.nodata_semantics ||
    !contract.zero_semantics
  ) {
    throw new ApiGeneralError(`Layer ${layerId} has an incomplete or unsupported representation contract.`, []);
  }
  const methodsByDataKind: Record<LayerRepresentationContract['data_kind'], string[]> = {
    amount: ['sum', 'area_weighted_mean', 'median', 'maximum', 'minimum'],
    density: ['area_weighted_mean', 'median', 'maximum', 'minimum'],
    probability: ['area_weighted_mean', 'median', 'maximum', 'minimum'],
    binary: ['any', 'fraction', 'mode', 'maximum', 'minimum'],
    categorical: ['mode'],
    cost: ['sum', 'area_weighted_mean', 'median', 'maximum', 'minimum']
  };
  const dataKind = contract.data_kind as LayerRepresentationContract['data_kind'];
  const aggregationMethod = String(contract.aggregation_method);
  if (!methodsByDataKind[dataKind].includes(aggregationMethod)) {
    throw new ApiGeneralError(`Layer ${layerId} cannot use ${aggregationMethod} aggregation for ${dataKind} data.`, []);
  }
  const quantityKind = contract.extensive_or_intensive;
  if (!['extensive', 'intensive', 'categorical'].includes(String(quantityKind))) {
    throw new ApiGeneralError(`Layer ${layerId} has unsupported quantity semantics.`, []);
  }
  if (aggregationMethod === 'mode' && quantityKind !== 'categorical') {
    throw new ApiGeneralError(
      `Layer ${layerId} must declare categorical quantity semantics when using mode aggregation.`,
      []
    );
  }
  if (aggregationMethod === 'sum' && quantityKind !== 'extensive') {
    throw new ApiGeneralError(
      `Layer ${layerId} must declare extensive quantity semantics when using sum aggregation.`,
      []
    );
  }
  if (
    aggregationMethod === 'mode' &&
    (!contract.aggregation_parameters || contract.aggregation_parameters.tie_rule !== 'lowest_value')
  ) {
    throw new ApiGeneralError(`Layer ${layerId} must declare the deterministic mode tie rule 'lowest_value'.`, []);
  }
  return {
    schema_version: 1,
    layer_id: layerId,
    contract_version: contract.contract_version,
    native_resolution: nativeResolution,
    native_crs: nativeCrs,
    native_transform:
      Array.isArray(nativeTransformCandidate) && nativeTransformCandidate.length === 6
        ? (nativeTransformCandidate.map(Number) as LayerRepresentationContract['native_transform'])
        : null,
    native_shape:
      Array.isArray(nativeShapeCandidate) && nativeShapeCandidate.length === 2
        ? (nativeShapeCandidate.map(Number) as LayerRepresentationContract['native_shape'])
        : null,
    evidence_resolution: evidenceResolution,
    data_kind: contract.data_kind as LayerRepresentationContract['data_kind'],
    units: contract.units ?? null,
    valid_range: contract.valid_range ?? null,
    nodata_semantics: contract.nodata_semantics,
    zero_semantics: contract.zero_semantics,
    aggregation_method: contract.aggregation_method as LayerRepresentationContract['aggregation_method'],
    aggregation_parameters: contract.aggregation_parameters ?? {},
    extensive_or_intensive: contract.extensive_or_intensive ?? 'intensive',
    coarse_to_fine_policy: coarseToFinePolicy,
    mapping_contract_version: contract.mapping_contract_version ?? 'native-affine-v1'
  };
}
