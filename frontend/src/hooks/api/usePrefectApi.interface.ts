export interface OptimizationConstraint {
  min?: number | null;
  max?: number | null;
  type?: string;
}

export interface OptimizationLayer {
  mode: 'flexible' | 'locked-in' | 'locked-out';
  importance?: number;
  threshold?: number;
  constraints?: OptimizationConstraint[];
}
export interface OptimizationParameters {
  resolution: number;
  layers: {
    [layerPath: string]: OptimizationLayer;
  };
}
