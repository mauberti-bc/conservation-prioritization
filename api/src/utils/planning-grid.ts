import { ApiGeneralError } from '../errors/api-error';
import { PlanningGridDefinition } from '../models/planning-grid.interface';

export const BC_GRID_FAMILY_ID = 'bc_albers_30m_v1';
export const BC_GRID_LEVELS = [30, 60, 120, 240, 480, 960, 1920] as const;
export const DEFAULT_PLANNING_UNIT_RESOLUTION = 240;

/**
 * Resolves a supported resolution to its immutable nested grid level.
 *
 * @param {number} resolution Requested planning-unit resolution in metres.
 * @returns {number} Zero-based power-of-two level.
 */
export function getPlanningGridLevel(resolution: number): number {
  const level = BC_GRID_LEVELS.findIndex((candidate) => candidate === resolution);
  if (level < 0) {
    throw new ApiGeneralError(
      `Unsupported planning-unit resolution ${resolution} m. Supported levels: ${BC_GRID_LEVELS.join(', ')} m.`,
      []
    );
  }
  return level;
}

/**
 * Creates the persisted grid definition shared by count, solve, and publication.
 *
 * @param {number} resolution Planning-unit resolution in metres.
 * @param {string} maskLineage Hash of the AOI definition.
 * @param {unknown} extent Published grid extent metadata.
 * @param {unknown} sourceShape Published grid shape metadata.
 * @param {Record<string, unknown>} lineage Source lineage.
 * @returns {PlanningGridDefinition} Immutable regular-grid definition.
 */
export function createPlanningGridDefinition(
  resolution: number,
  maskLineage: string,
  extent: unknown,
  sourceShape: unknown,
  lineage: Record<string, unknown>
): PlanningGridDefinition {
  const gridLevel = getPlanningGridLevel(resolution);
  const resolvedExtent = Array.isArray(extent) && extent.length === 4 ? extent.map(Number) : null;
  return {
    type: 'regular_grid',
    grid_family_id: BC_GRID_FAMILY_ID,
    grid_family_version: 1,
    grid_level: gridLevel,
    crs: 'EPSG:3005',
    planning_unit_resolution: resolution,
    base_cell_size: 30,
    scale_factor: 2 ** gridLevel,
    origin: [0, 0],
    transform: resolvedExtent ? [resolvedExtent[0], resolution, 0, resolvedExtent[3], 0, -resolution] : null,
    extent,
    source_shape: sourceShape,
    row_orientation: 'north_to_south',
    cell_id_encoding: 'row_major_uint64_v1',
    aoi_inclusion_rule: 'cell_center_v1',
    mask_lineage: maskLineage,
    lineage
  };
}

/**
 * Encodes a stable row-major cell identifier with checked integer arithmetic.
 *
 * @param {number} row Zero-based grid row.
 * @param {number} column Zero-based grid column.
 * @param {number} gridWidth Full grid width at this level.
 * @returns {bigint} Stable grid cell identifier.
 */
export function encodeGridCellId(row: number, column: number, gridWidth: number): bigint {
  if (![row, column, gridWidth].every(Number.isSafeInteger) || row < 0 || column < 0 || gridWidth <= column) {
    throw new ApiGeneralError('Invalid row, column, or grid width for grid-cell encoding.', []);
  }
  return BigInt(row) * BigInt(gridWidth) + BigInt(column);
}
