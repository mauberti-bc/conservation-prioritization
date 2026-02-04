/**
 * Layer metadata structure based on parsed Zarr metadata.
 */
interface ZarrArrayMeta {
  group: string; // e.g., 'landcover/disturbance'
  path: string; // e.g., 'landcover/disturbance/mining'
  name: string; // Display name (from zattrs.label)
  description?: string;
  shape: number[];
  dtype: string;
}

const IGNORED_NAMES = new Set(['x', 'y', 'spatial_ref']);

/**
 * Parses arrays from the consolidated metadata of the Zarr store.
 *
 * @param {Record<string, any>} metadata - The consolidated metadata from Zarr store.
 * @returns {ZarrArrayMeta[]} - Array of parsed layer metadata.
 */
function parseArraysFromConsolidatedMetadata(metadata: Record<string, any>): ZarrArrayMeta[] {
  const arrays: ZarrArrayMeta[] = [];

  for (const path in metadata) {
    if (!path.endsWith('/.zarray')) {
      continue;
    }

    const arrayPath = path.replace(/^\//, '').replace(/\/\.zarray$/, '');
    const zarrayMeta = metadata[path];

    if (!zarrayMeta || typeof zarrayMeta !== 'object') {
      console.warn(`Skipping invalid zarray metadata at path: ${path}`);
      continue;
    }

    const zattrsMeta = metadata[`${arrayPath}/.zattrs`];
    const pathParts = arrayPath.split('/');

    if (!Array.isArray(pathParts) || pathParts.length === 0) {
      console.warn(`Skipping malformed path: ${arrayPath}`);
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
      console.warn(`Skipping array with invalid shape/dtype at: ${arrayPath}`);
      continue;
    }

    arrays.push({
      group,
      path: arrayPath,
      name: typeof label === 'string' ? label : name,
      description: typeof description === 'string' ? description : '',
      shape,
      dtype
    });
  }

  // Sorting layers: Prioritize "landcover" layers
  return arrays.sort((a, b) => {
    const aPriority = a.path?.startsWith('landcover') ? -1 : 0;
    const bPriority = b.path?.startsWith('landcover') ? -1 : 0;
    return aPriority - bPriority;
  });
}
