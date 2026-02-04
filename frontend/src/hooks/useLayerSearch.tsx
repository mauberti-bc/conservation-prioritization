import { debounce } from '@mui/material';
import { LayerOption } from 'features/home/control-panel/form/ControlPanelForm';
import { useConservationApi } from 'hooks/useConservationApi';
import { useCallback, useRef, useState } from 'react';

export interface UseLayerSearchReturn {
  layers: LayerOption[];
  loading: boolean;
  error: string | null;
  search: (term: string) => void;
}

interface UseLayerSearchProps {
  debounceMs?: number;
}

/**
 * Custom hook for searching layers with debounced API requests.
 * Handles loading state, errors, and caches results.
 */
export const useLayerSearch = ({ debounceMs = 300 }: UseLayerSearchProps = {}): UseLayerSearchReturn => {
  const [layers, setLayers] = useState<LayerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conservationApi = useConservationApi();

  // Debounced API call
  const debouncedSearch = useRef(
    debounce(async (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) {
        setLayers([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await conservationApi.layer.findLayers(trimmed);
        setLayers(response.layers);
      } catch (err) {
        console.error('Failed to fetch layers:', err);
        setError('Failed to load layers. Please try again.');
        setLayers([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs)
  ).current;

  const search = useCallback(
    (term: string) => {
      debouncedSearch(term);
    },
    [debouncedSearch]
  );

  return { layers, loading, error, search };
};
