export interface TaskLayerOption {
  path: string;
  name: string;
  description?: string;
  group: string;
  evidence_resolution?: number;
  representation_contract?: Record<string, unknown>;
}

export interface TaskObjectiveConfig {
  name: string;
  path: string;
  direction: 'maximize' | 'minimize';
  importance: number;
}

export interface TaskConstraintConfig {
  id: string;
  type: 'aggregate' | 'planning_unit';
  layer: string;
  min: number | null;
  max: number | null;
}

export const initialTaskObjectiveValues: TaskObjectiveConfig = {
  name: '',
  path: '',
  direction: 'maximize',
  importance: 50,
};

export type GroupedLayers = Record<string, TaskLayerOption[]>;

export type FlattenedOption =
  | { type: 'group'; groupPath: string[]; depth: number }
  | { type: 'layer'; groupPath: string[]; depth: number; layer: TaskLayerOption };
