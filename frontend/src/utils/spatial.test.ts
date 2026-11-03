import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import { describe, expect, it } from 'vitest';
import { getFeaturesBounds } from './spatial';

describe('spatial bounds utilities', () => {
  it('merges longitude and latitude extents across every GeoJSON feature', () => {
    const features: Feature<Geometry, GeoJsonProperties>[] = [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-124, 49],
              [-123, 49],
              [-123, 50],
              [-124, 50],
              [-124, 49],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [-130, 52],
                [-129, 52],
                [-129, 53],
                [-130, 53],
                [-130, 52],
              ],
            ],
            [
              [
                [-122, 48],
                [-121, 48],
                [-121, 49],
                [-122, 49],
                [-122, 48],
              ],
            ],
          ],
        },
      },
    ];

    expect(getFeaturesBounds(features)).toEqual([
      [-130, 48],
      [-121, 53],
    ]);
  });

  it('returns null when no coordinate-bearing features are available', () => {
    expect(getFeaturesBounds([])).toBeNull();
  });
});
