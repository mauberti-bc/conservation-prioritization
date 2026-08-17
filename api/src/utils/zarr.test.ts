import { expect } from 'chai';
import { parseArraysFromConsolidatedMetadata } from './zarr';

describe('zarr metadata', () => {
  it('exposes only authoritative native arrays and ignores derived caches', () => {
    const contract = { evidence_resolution: 30, aggregation_method: 'sum' };
    const layers = parseArraysFromConsolidatedMetadata({
      '.zattrs': {
        storage_model: 'authoritative_native_resolution_v1',
        layer_descriptors: {
          'habitat/value': { array_path: 'habitat/value' }
        }
      },
      'habitat/value/.zarray': { shape: [4, 4], dtype: '<f4' },
      'habitat/value/.zattrs': {
        label: 'Habitat amount',
        representation_contract: contract
      },
      'derived/240m/habitat/value/.zarray': { shape: [1, 1], dtype: '<f4' },
      'derived/240m/habitat/value/.zattrs': { representation_contract: contract }
    });
    expect(layers).to.have.length(1);
    expect(layers[0].path).to.equal('habitat/value');
    expect(layers[0].evidence_resolution).to.equal(30);
    expect(layers[0].representation_contract).to.deep.equal(contract);
  });
});
