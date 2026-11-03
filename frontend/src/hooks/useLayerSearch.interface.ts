import { TaskLayerOption } from 'features/home/task/create/form/layer/optimization-form.interface';

export interface UseLayerSearchReturn {
  layers: TaskLayerOption[];
  loading: boolean;
  error: string | null;
  search: (term: string) => void;
}
