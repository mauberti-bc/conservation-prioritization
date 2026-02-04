import { createContext, PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { TaskLayerOption } from 'features/home/task/create/form/layer/task-layer.interface';

export interface ILayerSelectionContext {
  selectedLayers: TaskLayerOption[];
  setSelectedLayers: (layers: TaskLayerOption[]) => void;
  toggleLayer: (layer: TaskLayerOption) => void;
  clearSelection: () => void;
}

export const LayerSelectionContext = createContext<ILayerSelectionContext>({
  selectedLayers: [],
  setSelectedLayers: () => undefined,
  toggleLayer: () => undefined,
  clearSelection: () => undefined,
});

/**
 * Stores the currently selected layers across the UI.
 */
export const LayerSelectionContextProvider = (props: PropsWithChildren<Record<never, any>>) => {
  const [selectedLayers, setSelectedLayers] = useState<TaskLayerOption[]>([]);

  const toggleLayer = useCallback((layer: TaskLayerOption) => {
    setSelectedLayers((prev) => {
      const exists = prev.some((item) => item.path === layer.path);
      if (exists) {
        return prev.filter((item) => item.path !== layer.path);
      }
      return [...prev, layer];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLayers([]);
  }, []);

  const contextValue = useMemo(() => {
    return {
      selectedLayers,
      setSelectedLayers,
      toggleLayer,
      clearSelection,
    };
  }, [clearSelection, selectedLayers, toggleLayer]);

  return <LayerSelectionContext.Provider value={contextValue}>{props.children}</LayerSelectionContext.Provider>;
};
