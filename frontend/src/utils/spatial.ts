import { Feature, GeoJsonProperties, Geometry, GeometryCollection, Polygon, Position } from 'geojson';

export type GeoJsonBounds = [[number, number], [number, number]];

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
 * Extends mutable longitude/latitude bounds with one GeoJSON position.
 *
 * @param {Position} position GeoJSON coordinate tuple in longitude, latitude order.
 * @param {GeoJsonBounds} bounds Mutable southwest and northeast bounds to update in place.
 * @returns {void}
 */
function extendBoundsFromPosition(position: Position, bounds: GeoJsonBounds): void {
  const [longitude, latitude] = position;
  bounds[0][0] = Math.min(bounds[0][0], longitude);
  bounds[0][1] = Math.min(bounds[0][1], latitude);
  bounds[1][0] = Math.max(bounds[1][0], longitude);
  bounds[1][1] = Math.max(bounds[1][1], latitude);
}

/**
 * Recursively extends bounds from arbitrarily nested GeoJSON coordinates.
 *
 * @param {unknown} coordinates GeoJSON coordinates from a point, line, polygon, or multi-geometry.
 * @param {GeoJsonBounds} bounds Mutable southwest and northeast bounds to update in place.
 * @returns {void}
 */
function extendBoundsFromCoordinates(coordinates: unknown, bounds: GeoJsonBounds): void {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    extendBoundsFromPosition(coordinates as Position, bounds);
    return;
  }

  for (const coordinate of coordinates) {
    extendBoundsFromCoordinates(coordinate, bounds);
  }
}

/**
 * Narrows a GeoJSON geometry to coordinate-bearing geometry types.
 *
 * @param {Geometry} geometry GeoJSON geometry to inspect.
 * @returns {boolean} True when the geometry exposes a coordinates property.
 */
function hasCoordinates(geometry: Geometry): geometry is Exclude<Geometry, GeometryCollection> {
  return geometry.type !== 'GeometryCollection';
}

/**
 * Extends bounds from a GeoJSON geometry, including nested geometry collections.
 *
 * @param {Geometry} geometry GeoJSON geometry to inspect.
 * @param {GeoJsonBounds} bounds Mutable southwest and northeast bounds to update in place.
 * @returns {void}
 */
function extendBoundsFromGeometry(geometry: Geometry, bounds: GeoJsonBounds): void {
  if (!hasCoordinates(geometry)) {
    for (const childGeometry of geometry.geometries) {
      extendBoundsFromGeometry(childGeometry, bounds);
    }
    return;
  }

  extendBoundsFromCoordinates(geometry.coordinates, bounds);
}

/**
 * Computes map bounds for a GeoJSON feature.
 *
 * @param {Feature<Geometry, GeoJsonProperties>} feature GeoJSON feature to inspect.
 * @returns {GeoJsonBounds | null} Southwest and northeast corners, or null when coordinates are unavailable.
 */
export function getFeatureBounds(feature: Feature<Geometry, GeoJsonProperties>): GeoJsonBounds | null {
  const bounds: GeoJsonBounds = [
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  ];

  extendBoundsFromGeometry(feature.geometry, bounds);

  if (!Number.isFinite(bounds[0][0]) || !Number.isFinite(bounds[0][1])) {
    return null;
  }

  return bounds;
}

/**
 * Computes merged map bounds for a list of GeoJSON features.
 *
 * @param {Feature<Geometry, GeoJsonProperties>[]} features GeoJSON features to inspect in longitude/latitude order.
 * @returns {GeoJsonBounds | null} Bounds covering every feature, or null when no coordinates are available.
 */
export function getFeaturesBounds(features: Feature<Geometry, GeoJsonProperties>[]): GeoJsonBounds | null {
  const bounds: GeoJsonBounds = [
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  ];

  for (const feature of features) {
    extendBoundsFromGeometry(feature.geometry, bounds);
  }

  if (!Number.isFinite(bounds[0][0]) || !Number.isFinite(bounds[0][1])) {
    return null;
  }

  return bounds;
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
