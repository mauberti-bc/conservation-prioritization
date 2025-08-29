import { LayerOption } from '../ControlPanelForm';
import { LayerConstraint } from './card/constraint/item/LayerConstraintItem';

export type LayerMode = 'flexible' | 'locked-in' | 'locked-out';

export interface Layer {
  name: string;
  path: string;
  importance?: number;
  threshold?: number;
  mode: LayerMode;
  constraints: LayerConstraint[];
}

export const initialLayerValues: Layer = {
  name: '',
  path: '',
  threshold: 0,
  importance: 0,
  mode: 'flexible',
  constraints: [],
};

export type GroupedLayers = Record<string, LayerOption[]>;

export type FlattenedOption =
  | { type: 'group'; groupPath: string[]; depth: number }
  | { type: 'layer'; groupPath: string[]; depth: number; layer: LayerOption };
