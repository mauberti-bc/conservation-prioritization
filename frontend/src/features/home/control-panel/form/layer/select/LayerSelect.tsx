import { LayerOption } from 'features/home/control-panel/form/ControlPanelForm';
import { LayerOptionAutocomplete } from './autocomplete/LayerOptionAutocomplete';

interface LayerSelectProps {
  selectedLayers: LayerOption[];
  onLayerChange: (layer: LayerOption) => void;
  showCheckbox?: boolean;
}

/**
 * Simple wrapper for layer selection.
 * Passes props directly to LayerOptionAutocomplete.
 */
export const LayerSelect = ({ selectedLayers, onLayerChange, showCheckbox }: LayerSelectProps) => (
  <LayerOptionAutocomplete selectedLayers={selectedLayers} onLayerChange={onLayerChange} showCheckbox={showCheckbox} />
);
