import { describe, expect, it } from 'vitest';
import { OPTIMIZATION_MODE } from 'hooks/interfaces/useTaskApi.interface';
import { buildTaskSubmission } from './task-submission';

describe('task submission mapping', () => {
  it('preserves every visible create/copy/submit property in one request', () => {
    const payload = buildTaskSubmission({
      type: 'discrete_optimization',
      name: 'Scenario',
      description: 'Description',
      optimizationMode: OPTIMIZATION_MODE.BALANCED,
      resolution: 60,
      resampling: 'max',
      neighborPenaltyEnabled: true,
      neighborPenaltyStrength: 2,
      objectives: [
        {
          name: 'Feature',
          path: 'ecological/feature',
          direction: 'maximize',
          importance: 25,
        },
      ],
      constraints: [
        { id: 'feature-constraint', type: 'planning_unit', layer: 'ecological/feature', min: 2, max: 8 },
        { id: 'budget-constraint', type: 'aggregate', layer: 'financial/cost', min: null, max: 1000 },
      ],
      targetArea: [
        {
          id: 'geometry',
          mapboxFeatureId: 'geometry',
          name: 'AOI',
          description: 'Area',
          geojson: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [-123, 49] },
          },
        },
      ],
    });

    expect(payload).toEqual({
      optimization_mode: 'balanced',
      resolution: 60,
      planning_unit_resolution: 60,
      resampling: 'max',
      target_area: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [-123, 49] },
          },
        ],
      },
      objectives: [{ layer: 'ecological/feature', direction: 'maximize', importance: 25 }],
      constraints: [
        { type: 'planning_unit', layer: 'ecological/feature', min: 2, max: 8 },
        { type: 'aggregate', layer: 'financial/cost', min: null, max: 1000 },
      ],
      neighbor_penalty: { strength: 2 },
    });
  });
});
