/**
 * Optimization constraint for Prefect flow parameters.
 */
export interface OptimizationConstraint {
  min?: number | null;
  max?: number | null;
  type: 'percent' | 'unit';
}

/**
 * Optimization layer configuration for Prefect flow parameters.
 */
export interface OptimizationLayer {
  mode: 'flexible' | 'locked-in' | 'locked-out';
  importance?: number | null;
  threshold?: number | null;
  constraints?: OptimizationConstraint[];
}

/**
 * Optimization geometry wrapper expected by Prefect.
 */
export interface OptimizationGeometry {
  geojson: {
    geometry: unknown;
    [key: string]: unknown;
  };
}

/**
 * Optimization parameters for Prefect flow runs.
 */
export interface OptimizationParameters {
  resolution: number;
  resampling: 'mode' | 'min' | 'max';
  layers: Record<string, OptimizationLayer>;
  target_area: number;
  is_percentage: boolean;
  geometry?: OptimizationGeometry[];
}
