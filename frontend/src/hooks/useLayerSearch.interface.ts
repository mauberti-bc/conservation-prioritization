import { TaskLayerOption } from 'features/home/task/create/form/layer/task-layer.interface';

export interface UseLayerSearchReturn {
  layers: TaskLayerOption[];
  loading: boolean;
  error: string | null;
  search: (term: string) => void;
}
