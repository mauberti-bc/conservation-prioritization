import { LayerOption } from 'features/home/control-panel/form/ControlPanelForm';

export interface UseLayerSearchReturn {
  filtered: LayerOption[];
  loading: boolean;
  error: string | null;
  handleSearch: (term: string) => void;
}
