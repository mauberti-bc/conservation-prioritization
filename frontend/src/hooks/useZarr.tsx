import { useEffect, useState } from 'react';
import * as zarr from 'zarrita';

type ZarrArrayMeta = {
  group: string; // e.g. 'landcover/disturbance'
  path: string; // e.g. 'landcover/disturbance/mining'
  name: string; // Display name (from zattrs.label)
  description?: string;
  shape: number[];
  dtype: string;
};

interface UseZarrResult {
  variables: ZarrArrayMeta[];
  loading: boolean;
  error: Error | null;
}

const IGNORED_NAMES = new Set(['x', 'y', 'spatial_ref']);

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
      dtype,
    });
  }

  return arrays.sort((a, b) => {
    const aPriority = a.path?.startsWith('landcover') ? -1 : 0;
    const bPriority = b.path?.startsWith('landcover') ? -1 : 0;
    return aPriority - bPriority;
  });
}

export const useZarr = (zarrUrl: string): UseZarrResult => {
  const [variables, setVariables] = useState<ZarrArrayMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchZarr = async () => {
      try {
        const fullUrl = new URL(zarrUrl, window.location.origin).toString();
        const store = new zarr.FetchStore(fullUrl);
        const location = zarr.root(store);

        const metadataPath = location.resolve('.zmetadata').path;
        const consolidatedMetadata = JSON.parse(new TextDecoder().decode(await store.get(metadataPath)));

        const arrays = parseArraysFromConsolidatedMetadata(consolidatedMetadata.metadata);

        if (!cancelled) {
          setVariables(arrays);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
        console.error('Error loading zarr arrays:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchZarr();

    return () => {
      cancelled = true;
    };
  }, [zarrUrl]);

  return { variables, loading, error };
};
