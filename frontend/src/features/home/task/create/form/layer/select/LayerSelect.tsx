import { TaskLayerOption } from '../task-layer.interface';
import { LayerOptionAutocomplete } from './autocomplete/LayerOptionAutocomplete';

interface LayerSelectProps {
  selectedLayers: TaskLayerOption[];
  onLayerChange: (layer: TaskLayerOption) => void;
  showCheckbox?: boolean;
}

/**
 * Simple wrapper for layer selection.
 * Passes props directly to LayerOptionAutocomplete.
 */
export const LayerSelect = ({ selectedLayers, onLayerChange, showCheckbox }: LayerSelectProps) => (
  <LayerOptionAutocomplete selectedLayers={selectedLayers} onLayerChange={onLayerChange} showCheckbox={showCheckbox} />
);
