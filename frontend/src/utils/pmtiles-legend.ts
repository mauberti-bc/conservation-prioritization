import {
  DEFAULT_PMTILES_LEGEND_COLOR_RAMP,
  PMTILES_LEGEND_ROWS,
  PMTILES_LEGEND_TITLES,
  PMTILES_SURFACES,
} from 'constants/pmtiles-legend';
import { TASK_TYPE } from 'hooks/interfaces/useTaskApi.interface';
import { PmtilesLegendDefinition, PmtilesLegendEntry, PmtilesSurface } from 'utils/pmtiles-legend.interface';

/**
 * Gets the expected PMTiles legend entry when tile metadata is unavailable.
 *
 * @param {TASK_TYPE | null | undefined} taskType Task type used to infer the output surface.
 * @returns {PmtilesLegendEntry} Fallback legend entry for the rendered task output.
 */
export const getFallbackPmtilesLegendEntry = (taskType?: TASK_TYPE | null): PmtilesLegendEntry => {
  if (taskType === 'continuous_optimization') {
    return {
      surface: 'allocation',
      colorRamp: null,
    };
  }

  if (taskType === 'priority_ranking') {
    return {
      surface: 'priority',
      colorRamp: null,
    };
  }

  return {
    surface: 'decision',
    colorRamp: null,
  };
};

/**
 * Converts PMTiles metadata into the legend entry used by the map.
 *
 * @param {Record<string, unknown>} metadata PMTiles metadata record.
 * @param {TASK_TYPE | null | undefined} taskType Task type used when metadata lacks a valid surface.
 * @returns {PmtilesLegendEntry} Normalized legend entry for the tileset.
 */
export const getPmtilesLegendEntryFromMetadata = (
  metadata: Record<string, unknown>,
  taskType?: TASK_TYPE | null
): PmtilesLegendEntry => {
  const surface = metadata.surface;
  const colorRamp = metadata.color_ramp;

  if (!isPmtilesSurface(surface)) {
    return getFallbackPmtilesLegendEntry(taskType);
  }

  return {
    surface,
    colorRamp: typeof colorRamp === 'string' ? colorRamp : null,
  };
};

/**
 * Gets the URL PMTiles should use when reading archive metadata.
 *
 * @param {string} url PMTiles source URL, with or without the pmtiles protocol prefix.
 * @returns {string} URL accepted by the PMTiles metadata reader.
 */
export const getPmtilesMetadataUrl = (url: string): string => {
  if (url.startsWith('pmtiles://')) {
    return url.slice('pmtiles://'.length);
  }

  return url;
};

/**
 * Converts a PMTiles legend entry into a render-ready legend definition.
 *
 * @param {PmtilesLegendEntry} entry Normalized PMTiles legend entry.
 * @returns {PmtilesLegendDefinition} Legend title and rows for the entry.
 */
export const getPmtilesLegendDefinition = (entry: PmtilesLegendEntry): PmtilesLegendDefinition => {
  return {
    key: `${entry.surface}:${entry.colorRamp ?? DEFAULT_PMTILES_LEGEND_COLOR_RAMP}`,
    title: PMTILES_LEGEND_TITLES[entry.surface],
    rows: PMTILES_LEGEND_ROWS[entry.surface],
  };
};

/**
 * Removes duplicate PMTiles legend definitions while preserving first-seen order.
 *
 * @param {PmtilesLegendEntry[]} entries Legend entries from currently rendered PMTiles outputs.
 * @returns {PmtilesLegendDefinition[]} Unique legend definitions for display.
 */
export const getUniquePmtilesLegendDefinitions = (entries: PmtilesLegendEntry[]): PmtilesLegendDefinition[] => {
  const uniqueDefinitions = new Map<string, PmtilesLegendDefinition>();

  entries.forEach((entry) => {
    const definition = getPmtilesLegendDefinition(entry);
    uniqueDefinitions.set(definition.key, definition);
  });

  return Array.from(uniqueDefinitions.values());
};

const isPmtilesSurface = (value: unknown): value is PmtilesSurface => {
  return typeof value === 'string' && PMTILES_SURFACES.includes(value as PmtilesSurface);
};
