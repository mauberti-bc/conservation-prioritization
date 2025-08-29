import { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';

/**
 * Checks if a given polygon feature has at least 4 points
 * and is properly closed (first and last point are equal).
 */
function isValidPolygon(feature: Feature<Geometry, GeoJsonProperties>): boolean {
  if (feature.geometry.type !== 'Polygon') {
    return false;
  }

  const coordinates = (feature.geometry as Polygon).coordinates;

  // A polygon must have at least one linear ring
  if (!coordinates || coordinates.length === 0) {
    return false;
  }

  const outerRing = coordinates[0];

  // A valid linear ring must have at least 4 positions and be closed
  if (outerRing.length < 4) {
    return false;
  }

  const [first, last] = [outerRing[0], outerRing[outerRing.length - 1]];

  return arraysEqual(first, last);
}

/**
 * Deep equality for coordinate pairs.
 */
function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((val, i) => val === b[i]);
}

/**
 * Validates a list of GeoJSON features.
 * Returns an object with validity and error message if any.
 */
export function validateGeometry(features: Feature[]): {
  isValid: boolean;
  message?: string;
} {
  if (!features.length) {
    return { isValid: false, message: 'No geometry provided.' };
  }

  const invalidIndex = features.findIndex((f) => !isValidPolygon(f));
  if (invalidIndex !== -1) {
    return {
      isValid: false,
      message: `Feature at index ${invalidIndex} is not a valid polygon.`,
    };
  }

  return { isValid: true };
}
