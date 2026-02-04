import { debounce } from '@mui/material';
import { LayerOption } from 'features/home/control-panel/form/ControlPanelForm';
import { useConservationApi } from 'hooks/useConservationApi';
import { useCallback, useMemo, useRef, useState } from 'react';
import { UseLayerSearchReturn } from './useLayerSearch.interface';

interface useLayerSearchProps {
  debounceMs?: number;
}
/**
 * Custom hook to search for layers with debounced API requests.
 *
 * @param {number} debounceMs - Debounce delay in milliseconds.
 * @returns {UseLayerSearchReturn} - Object containing filtered layers, loading state, and any errors.
 */
export const useLayerSearch = (props: useLayerSearchProps): UseLayerSearchReturn => {
  const { debounceMs } = props;
  const [layers, setLayers] = useState<LayerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conservationApi = useConservationApi();

  // Ref to hold the debounced function
  const debouncedFetchLayers = useRef(
    debounce(async (term: string) => {
      const trimmed = term.trim();

      if (!trimmed) {
        return;
      }

      setLoading(true);
      try {
        const fetchedLayers = await conservationApi.layer.findLayers(term);
        setLayers(fetchedLayers.layers);
      } catch (err) {
        console.error('Error fetching layers:', err);
        setError('Failed to fetch layers');
      } finally {
        setLoading(false);
      }
    }, debounceMs)
  ).current;

  // Debounced search handler
  const handleSearch = useCallback(
    (term: string) => {
      debouncedFetchLayers(term);
    },
    [debouncedFetchLayers]
  );

  const filtered = useMemo(() => layers, [layers]);

  return { filtered, loading, error, handleSearch };
};
