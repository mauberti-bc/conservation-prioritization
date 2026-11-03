import { expect } from 'chai';
import { describe } from 'mocha';
import { toSubmitTaskRequest } from './submit-task.interface';

describe('toSubmitTaskRequest', () => {
  it('preserves every immutable-run property sent by a client', () => {
    const payload = toSubmitTaskRequest({
      resolution: 60,
      planning_unit_resolution: 60,
      resampling: 'max',
      target_area: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-123, 49] } }]
      },
      objectives: [{ layer: 'habitat/value', direction: 'maximize', importance: 2 }],
      constraints: [{ type: 'aggregate', layer: 'cost/value', max: 100 }],
      neighbor_penalty: { strength: 2 },
      export_selected_parquet: true
    });

    expect(payload).to.deep.equal({
      resolution: 60,
      planning_unit_resolution: 60,
      resampling: 'max',
      target_area: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-123, 49] } }]
      },
      objectives: [{ layer: 'habitat/value', direction: 'maximize', importance: 2 }],
      constraints: [{ type: 'aggregate', layer: 'cost/value', max: 100 }],
      neighbor_penalty: { strength: 2 },
      export_selected_parquet: true
    });
  });
});
