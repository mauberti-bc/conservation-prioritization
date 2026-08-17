import { Feature, FeatureCollection, Geometry } from 'geojson';
import { TaskType } from './task';

/** Optional normalized reward for selected rook-adjacent planning-unit pairs. */
export interface NeighborPenaltyRequest {
  strength: number;
}

/** One user-facing additive objective over a scientific layer. */
export interface OptimizationObjectiveRequest {
  layer: string;
  direction: 'maximize' | 'minimize';
  importance?: number;
}

/** One aggregate requirement over the selected solution. */
export interface AggregateConstraintRequest {
  type: 'aggregate';
  layer: string;
  min?: number | null;
  max?: number | null;
}

/** One per-planning-unit requirement used to define the candidate domain. */
export interface PlanningUnitConstraintRequest {
  type: 'planning_unit';
  layer: string;
  min?: number | null;
  max?: number | null;
}

export type OptimizationConstraintRequest = AggregateConstraintRequest | PlanningUnitConstraintRequest;

/** GeoJSON target area from which candidate planning units are constructed. */
export type OptimizationTargetAreaRequest = Feature<Geometry> | FeatureCollection<Geometry>;

/**
 * Interface for creating a task draft.
 */
export interface CreateTaskDraftRequest {
  type?: TaskType;
  name: string;
  description?: string | null;
  resolution?: number;
  planning_unit_resolution?: number;
  resampling?: 'mode' | 'min' | 'max';
}

/**
 * Interface for submitting an existing draft task.
 */
export interface SubmitTaskRequest {
  optimization_mode?: 'interactive' | 'balanced' | 'exact_audit' | null;
  target_area: OptimizationTargetAreaRequest;
  objectives: OptimizationObjectiveRequest[];
  constraints: OptimizationConstraintRequest[];
  resolution?: number | null;
  planning_unit_resolution?: number | null;
  resampling?: 'mode' | 'min' | 'max' | null;
  neighbor_penalty?: NeighborPenaltyRequest | null;
  export_selected_parquet?: boolean;
}
