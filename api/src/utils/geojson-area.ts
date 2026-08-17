const EARTH_RADIUS_METRES = 6371008.8;

/**
 * Conservatively sums GeoJSON polygon areas on a sphere for early guidance.
 * Overlapping features are intentionally not unioned, so the estimate cannot
 * understate work because of overlap.
 *
 * @param {unknown[]} values GeoJSON Features or geometries in longitude/latitude.
 * @returns {number | null} Approximate square metres, or null when unavailable.
 */
export function estimateGeoJsonAreaSquareMetres(values: unknown[]): number | null {
  let area = 0;
  let found = false;
  for (const value of values) {
    const geometry = unwrapGeometry(value);
    if (!geometry) {
      continue;
    }
    const measured = measureGeometry(geometry);
    if (measured !== null) {
      area += measured;
      found = true;
    }
  }
  return found ? area : null;
}

/** Extracts a GeoJSON geometry object without assuming a feature wrapper. */
function unwrapGeometry(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const nested = record.geojson ?? record;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
    return null;
  }
  const geojson = nested as Record<string, unknown>;
  const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson.geometry ?? geojson;
  return geometry && typeof geometry === 'object' && !Array.isArray(geometry)
    ? (geometry as Record<string, unknown>)
    : null;
}

/** Measures polygonal GeoJSON and ignores unsupported non-area geometries. */
function measureGeometry(geometry: Record<string, unknown>): number | null {
  if (geometry.type === 'FeatureCollection' && Array.isArray(geometry.features)) {
    return geometry.features.reduce<number>((sum, feature) => {
      const child = unwrapGeometry(feature);
      return sum + (child ? measureGeometry(child) ?? 0 : 0);
    }, 0);
  }
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    return measurePolygon(geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.reduce<number>((sum, polygon) => {
      return sum + (Array.isArray(polygon) ? measurePolygon(polygon) : 0);
    }, 0);
  }
  if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
    return geometry.geometries.reduce<number>((sum, child) => {
      if (!child || typeof child !== 'object' || Array.isArray(child)) {
        return sum;
      }
      return sum + (measureGeometry(child as Record<string, unknown>) ?? 0);
    }, 0);
  }
  return null;
}

/** Measures an exterior ring minus holes using the spherical trapezoid formula. */
function measurePolygon(coordinates: unknown[]): number {
  return coordinates.reduce<number>((sum, ring, index) => {
    if (!Array.isArray(ring)) {
      return sum;
    }
    const ringArea = Math.abs(measureRing(ring));
    return index === 0 ? sum + ringArea : sum - ringArea;
  }, 0);
}

/** Measures one longitude/latitude ring on a sphere. */
function measureRing(coordinates: unknown[]): number {
  let area = 0;
  for (let index = 0; index < coordinates.length; index += 1) {
    const current = coordinates[index];
    const next = coordinates[(index + 1) % coordinates.length];
    if (!isPosition(current) || !isPosition(next)) {
      continue;
    }
    const longitudeDelta = degreesToRadians(next[0] - current[0]);
    area += longitudeDelta * (2 + Math.sin(degreesToRadians(current[1])) + Math.sin(degreesToRadians(next[1])));
  }
  return (area * EARTH_RADIUS_METRES ** 2) / 2;
}

function isPosition(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
