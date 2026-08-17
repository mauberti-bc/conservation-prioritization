import { expect } from 'chai';
import { LayerRepresentationContract } from '../models/layer-contract.interface';
import { classifyLayerMapping } from './layer-mapping';

describe('layer mapping compatibility', () => {
  const contract: LayerRepresentationContract = {
    schema_version: 1,
    layer_id: 'habitat/value',
    contract_version: 'test-v1',
    evidence_resolution: 30,
    native_resolution: 30,
    native_crs: 'EPSG:3005',
    native_transform: [0, 30, 0, 240, 0, -30],
    native_shape: [8, 8],
    data_kind: 'amount',
    units: null,
    valid_range: null,
    nodata_semantics: 'excluded_from_planning_units',
    zero_semantics: 'valid_absence_or_zero',
    aggregation_method: 'sum',
    aggregation_parameters: {},
    extensive_or_intensive: 'extensive',
    coarse_to_fine_policy: 'prohibit',
    mapping_contract_version: 'native-affine-v1'
  };

  it('uses nested aggregation only when affine origins align', () => {
    const nested = classifyLayerMapping(contract, 240, [0, 240, 0, 240, 0, -240], 'EPSG:3005');
    expect(nested.method).to.equal('nested_aggregate');

    const shifted = classifyLayerMapping(contract, 240, [15, 240, 0, 240, 0, -240], 'EPSG:3005');
    expect(shifted.method).to.equal('bounded_reproject');
  });

  it('rejects coarse evidence unless its contract explicitly supports mapping', () => {
    const coarse = {
      ...contract,
      evidence_resolution: 5000,
      native_resolution: 5000,
      native_transform: [0, 5000, 0, 10000, 0, -5000] as LayerRepresentationContract['native_transform']
    };
    expect(classifyLayerMapping(coarse, 240, null, 'EPSG:3005').method).to.equal('unsupported');
    expect(
      classifyLayerMapping({ ...coarse, coarse_to_fine_policy: 'nearest_constant' }, 240, null, 'EPSG:3005').method
    ).to.equal('coarse_to_fine_supported');
  });

  it('routes different coordinate systems through bounded reprojection', () => {
    const geographic = {
      ...contract,
      native_crs: 'EPSG:4326',
      evidence_resolution: 0.01,
      native_resolution: 0.01
    };
    expect(classifyLayerMapping(geographic, 240, null, 'EPSG:3005').method).to.equal('bounded_reproject');
  });
});
