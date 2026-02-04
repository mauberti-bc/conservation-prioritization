import { LayerConstraint } from './card/constraint/item/LayerConstraintItem';

export interface TaskLayerOption {
  path: string;
  name: string;
  description?: string;
  group: string;
}

export type TaskLayerMode = 'flexible' | 'locked-in' | 'locked-out';

export interface TaskLayerConfig {
  name: string;
  path: string;
  importance?: number;
  threshold?: number;
  mode: TaskLayerMode;
  constraints: LayerConstraint[];
}

export const initialTaskLayerValues: TaskLayerConfig = {
  name: '',
  path: '',
  threshold: 0,
  importance: 0,
  mode: 'flexible',
  constraints: [],
};

export type GroupedLayers = Record<string, TaskLayerOption[]>;

export type FlattenedOption =
  | { type: 'group'; groupPath: string[]; depth: number }
  | { type: 'layer'; groupPath: string[]; depth: number; layer: TaskLayerOption };
