import { LayerMeta } from '../models/layer.interface';

const IGNORED_NAMES = new Set(['x', 'y', 'spatial_ref']);

interface ZarrArrayMetadata {
  shape: number[];
  dtype: string;
}

interface ZarrAttrsMetadata {
  label?: string;
  description?: string;
  representation_contract?: Record<string, unknown>;
}

interface ZarrRootAttrsMetadata {
  storage_model?: string;
  layer_descriptors?: Record<string, { array_path?: string }>;
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
  const rootAttrs = parseMetadataValue<ZarrRootAttrsMetadata>(metadata['.zattrs']);
  const authoritativePaths = rootAttrs?.layer_descriptors
    ? new Set(
        Object.entries(rootAttrs.layer_descriptors).map(([layerId, descriptor]) => descriptor.array_path ?? layerId)
      )
    : null;

  for (const path in metadata) {
    // Skip malformed entries rather than fail the entire parse.
    if (!path.endsWith('/.zarray')) {
      continue;
    }

    const storedArrayPath = path.replace(/^\//, '').replace(/\/\.zarray$/, '');
    if (authoritativePaths && !authoritativePaths.has(storedArrayPath)) {
      continue;
    }
    const arrayPath = storedArrayPath;
    const zarrayMeta = parseMetadataValue<ZarrArrayMetadata>(metadata[path]);

    if (!zarrayMeta || typeof zarrayMeta !== 'object') {
      continue;
    }

    const zattrsMeta = parseMetadataValue<ZarrAttrsMetadata>(metadata[`${storedArrayPath}/.zattrs`]);
    const pathParts = arrayPath.split('/');

    if (!Array.isArray(pathParts) || pathParts.length === 0) {
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
      continue;
    }

    arrays.push({
      group,
      path: arrayPath,
      name: typeof label === 'string' ? label : name,
      description: typeof description === 'string' ? description : undefined,
      shape,
      dtype,
      evidence_resolution:
        typeof zattrsMeta?.representation_contract?.evidence_resolution === 'number'
          ? zattrsMeta.representation_contract.evidence_resolution
          : undefined,
      representation_contract: zattrsMeta?.representation_contract
    });
  }

  return arrays;
}
