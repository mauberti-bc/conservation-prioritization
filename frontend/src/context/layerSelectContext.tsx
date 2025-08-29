import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { createInputValueAndDetectFiltersHandler, doesLayerMatchFilters } from 'utils/filter-match';
import { LayerOption } from '../features/home/control-panel/form/ControlPanelForm';

interface LayerSelectContextValue {
  filteredLayers: LayerOption[];
  availableLayers: LayerOption[];
  inputValue: string;
  groupFilters: string[];

  setInputValue: (val: string) => void;
  setGroupFilters: React.Dispatch<React.SetStateAction<string[]>>;

  handleChange: (updated: LayerOption) => void;
}

const LayerSelectContext = createContext<LayerSelectContextValue | undefined>(undefined);

export const useLayerSelectContext = () => {
  const context = useContext(LayerSelectContext);
  if (!context) {
    throw new Error('useLayerSelectContext must be used within a LayerSelectContextProvider');
  }
  return context;
};

interface Props {
  availableLayers: LayerOption[];
  handleChange: (updated: LayerOption) => void;
  children: ReactNode;
}

export const LayerSelectContextProvider = ({ availableLayers, handleChange, children }: Props) => {
  const [inputValue, setInputValue] = useState('');
  const [groupFilters, setGroupFilters] = useState<string[]>([]);

  const setInputValueAndDetectFilters = useCallback(
    (input: string) => {
      return createInputValueAndDetectFiltersHandler(availableLayers, setInputValue, setGroupFilters)(input);
    },
    [availableLayers, setInputValue, setGroupFilters]
  );

  const filteredLayers = useMemo(() => {
    return availableLayers.filter((layer) => doesLayerMatchFilters(layer, inputValue, groupFilters));
  }, [availableLayers, inputValue, groupFilters]);

  const value: LayerSelectContextValue = useMemo(
    () => ({
      filteredLayers,
      availableLayers,
      inputValue,
      groupFilters,
      setInputValue: setInputValueAndDetectFilters,
      setGroupFilters,
      handleChange,
    }),

    [
      filteredLayers,
      availableLayers,
      inputValue,
      groupFilters,
      handleChange,
      setGroupFilters,
      setInputValueAndDetectFilters,
    ]
  );

  return <LayerSelectContext.Provider value={value}>{children}</LayerSelectContext.Provider>;
};
