import { expect } from 'chai';
import { estimateGeoJsonAreaSquareMetres } from './geojson-area';

describe('geojson-area', () => {
  it('produces a bounded preliminary area estimate for polygon features', () => {
    const area = estimateGeoJsonAreaSquareMetres([
      {
        geojson: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-123, 49],
                [-122.99, 49],
                [-122.99, 49.01],
                [-123, 49.01],
                [-123, 49]
              ]
            ]
          }
        }
      }
    ]);
    expect(area).to.not.equal(null);
    expect(area as number).to.be.greaterThan(700000);
    expect(area as number).to.be.lessThan(1000000);
  });
});
