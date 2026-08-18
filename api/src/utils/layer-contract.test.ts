import { expect } from 'chai';
import { resolveLayerContract } from './layer-contract';

describe('layer representation contract', () => {
  const baseContract = {
    contract_version: 'test-v1',
    evidence_resolution: 30,
    native_resolution: 30,
    native_crs: 'EPSG:3005',
    native_transform: [0, 30, 0, 60, 0, -30],
    native_shape: [2, 2],
    data_kind: 'density',
    units: null,
    valid_range: null,
    nodata_semantics: 'excluded_from_planning_units',
    zero_semantics: 'valid_absence_or_zero',
    aggregation_method: 'median',
    aggregation_parameters: {},
    extensive_or_intensive: 'intensive',
    coarse_to_fine_policy: 'prohibit',
    mapping_contract_version: 'native-affine-v1'
  };

  it('accepts median for continuous layers', () => {
    const contract = resolveLayerContract('habitat/value', {
      layer_contracts: { 'habitat/value': baseContract }
    });
    expect(contract.aggregation_method).to.equal('median');
  });

  it('rejects averaging categorical classes', () => {
    expect(() =>
      resolveLayerContract('habitat/class', {
        layer_contracts: {
          'habitat/class': {
            ...baseContract,
            data_kind: 'categorical',
            aggregation_method: 'area_weighted_mean'
          }
        }
      })
    ).to.throw('cannot use area_weighted_mean aggregation for categorical data');
  });

  it('requires a deterministic tie rule for mode', () => {
    expect(() =>
      resolveLayerContract('habitat/class', {
        layer_contracts: {
          'habitat/class': {
            ...baseContract,
            data_kind: 'categorical',
            aggregation_method: 'mode',
            extensive_or_intensive: 'categorical'
          }
        }
      })
    ).to.throw("must declare the deterministic mode tie rule 'lowest_value'");
  });

  it('uses explicit semantics for known legacy layers', () => {
    const source = {
      lineage: 'incomplete',
      base_resolution: 5000,
      crs: 'EPSG:3005'
    };
    const intactness = resolveLayerContract(
      'ecological/ecosystem_intactness/Ecosystem_Intactness',
      source,
      'mode'
    );
    const oldGrowth = resolveLayerContract(
      'ecological/old_growth/Old_Growth_TAP_Old_Growth_Type',
      source,
      'maximum'
    );
    const protectedAreas = resolveLayerContract(
      'land_designations/any_protected_areas',
      source,
      'mode'
    );

    expect(intactness.aggregation_method).to.equal('area_weighted_mean');
    expect(oldGrowth.aggregation_method).to.equal('mode');
    expect(oldGrowth.aggregation_parameters.tie_rule).to.equal('lowest_value');
    expect(protectedAreas.coarse_to_fine_policy).to.equal('nearest_constant');
  });
});
