import { TASK_TYPE } from 'hooks/interfaces/useTaskApi.interface';
import { PMTiles } from 'pmtiles';
import { useEffect, useMemo, useState } from 'react';
import {
  getFallbackPmtilesLegendEntry,
  getPmtilesLegendEntryFromMetadata,
  getPmtilesMetadataUrl,
  getUniquePmtilesLegendDefinitions,
} from 'utils/pmtiles-legend';
import { PmtilesLegendDefinition, PmtilesLegendEntry } from 'utils/pmtiles-legend.interface';

/**
 * Loads PMTiles metadata and returns unique legend definitions for the current map layers.
 *
 * @param {string[]} pmtilesUrls PMTiles URLs rendered on the map.
 * @param {TASK_TYPE | null | undefined} taskType Task type used when metadata is unavailable.
 * @returns {PmtilesLegendDefinition[]} Legend definitions ready for display.
 */
export const usePmtilesLegendDefinitions = (
  pmtilesUrls: string[],
  taskType?: TASK_TYPE | null
): PmtilesLegendDefinition[] => {
  const [entries, setEntries] = useState<PmtilesLegendEntry[]>([]);

  useEffect(() => {
    let isCancelled = false;
    const fallbackLegendEntry = getFallbackPmtilesLegendEntry(taskType);

    const loadMetadata = async (): Promise<void> => {
      const nextEntries: PmtilesLegendEntry[] = [];

      for (const url of pmtilesUrls) {
        try {
          const pmtiles = new PMTiles(getPmtilesMetadataUrl(url));
          const metadata = (await pmtiles.getMetadata()) as Record<string, unknown>;
          nextEntries.push(getPmtilesLegendEntryFromMetadata(metadata, taskType));
        } catch {
          nextEntries.push(fallbackLegendEntry);
        }
      }

      if (isCancelled) {
        return;
      }

      setEntries(nextEntries);
    };

    if (pmtilesUrls.length === 0) {
      setEntries([]);
      return undefined;
    }

    void loadMetadata();

    return () => {
      isCancelled = true;
    };
  }, [pmtilesUrls, taskType]);

  return useMemo(() => {
    return getUniquePmtilesLegendDefinitions(entries);
  }, [entries]);
};
