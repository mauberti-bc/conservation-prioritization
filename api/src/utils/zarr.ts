import { LayerMeta } from '../models/layer.interface';
import { getLogger } from './logger';

const defaultLog = getLogger('utils/zarr');

const IGNORED_NAMES = new Set(['x', 'y', 'spatial_ref']);

interface ZarrArrayMetadata {
  shape: number[];
  dtype: string;
}

interface ZarrAttrsMetadata {
  label?: string;
  description?: string;
}

const parseMetadataValue = <T>(value: unknown): T | null => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      return null;
    }
  }

  if (value && typeof value === 'object') {
    return value as T;
  }

  return null;
};

/**
 * Parses arrays from the consolidated metadata of the Zarr store.
 *
 * @param {Record<string, any>} metadata - The consolidated metadata from Zarr store.
 * @returns {LayerMeta[]} - Array of parsed layer metadata.
 */
export function parseArraysFromConsolidatedMetadata(metadata: Record<string, unknown>): LayerMeta[] {
  const arrays: LayerMeta[] = [];

  for (const path in metadata) {
    // Skip malformed entries rather than fail the entire parse.
    if (!path.endsWith('/.zarray')) {
      continue;
    }

    const arrayPath = path.replace(/^\//, '').replace(/\/\.zarray$/, '');
    const zarrayMeta = parseMetadataValue<ZarrArrayMetadata>(metadata[path]);

    if (!zarrayMeta || typeof zarrayMeta !== 'object') {
      defaultLog.debug({ label: 'parseArraysFromConsolidatedMetadata', message: 'Skipping invalid zarray metadata', path });
      continue;
    }

    const zattrsMeta = parseMetadataValue<ZarrAttrsMetadata>(metadata[`${arrayPath}/.zattrs`]);
    const pathParts = arrayPath.split('/');

    if (!Array.isArray(pathParts) || pathParts.length === 0) {
      defaultLog.debug({
        label: 'parseArraysFromConsolidatedMetadata',
        message: 'Skipping malformed path',
        path: arrayPath
      });
      continue;
    }

    const name = pathParts[pathParts.length - 1];

    if (!name || IGNORED_NAMES.has(name)) {
      continue;
    }

    const group = pathParts.slice(0, -1).join('/');

    const label = zattrsMeta?.label;
    const description = zattrsMeta?.description;

    const shape = zarrayMeta.shape;
    const dtype = zarrayMeta.dtype;

    if (!Array.isArray(shape) || typeof dtype !== 'string') {
      defaultLog.debug({
        label: 'parseArraysFromConsolidatedMetadata',
        message: 'Skipping array with invalid shape/dtype',
        path: arrayPath
      });
      continue;
    }

    arrays.push({
      group,
      path: arrayPath,
      name: typeof label === 'string' ? label : name,
      description: typeof description === 'string' ? description : undefined,
      shape,
      dtype
    });
  }

  return arrays;
}
