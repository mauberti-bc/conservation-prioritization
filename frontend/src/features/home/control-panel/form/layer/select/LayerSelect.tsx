import { LayerSelectContextProvider } from 'context/layerSelectContext';
import { LayerOption } from '../../ControlPanelForm';
import { LayerOptionAutocomplete } from './autocomplete/LayerOptionAutocomplete';

interface LayerSelectProps {
  selectedLayers: LayerOption[];
  availableLayers: LayerOption[];
  handleChange: (updated: LayerOption) => void;
  checkbox: boolean;
}

export const LayerSelect = (props: LayerSelectProps) => {
  const { checkbox, ...contextProps } = props;
  return (
    <LayerSelectContextProvider {...contextProps}>
      <LayerOptionAutocomplete checkbox={checkbox} />
    </LayerSelectContextProvider>
  );
};
