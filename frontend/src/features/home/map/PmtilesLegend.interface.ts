import { TASK_TYPE } from 'hooks/interfaces/useTaskApi.interface';

export interface PmtilesLegendProps {
  pmtilesUrls: string[];
  taskType?: TASK_TYPE | null;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
}
