import { TaskCreateFormValues } from 'features/home/task/create/form/TaskCreateForm';
import { SubmitTaskRequest } from 'hooks/interfaces/useTaskApi.interface';

/** Build one immutable optimization problem from identically shaped form state. */
export function buildTaskSubmission(values: TaskCreateFormValues): SubmitTaskRequest {
  return {
    optimization_mode: values.optimizationMode,
    resolution: values.resolution,
    planning_unit_resolution: values.resolution,
    resampling: values.resampling,
    target_area: {
      type: 'FeatureCollection',
      features: values.targetArea.map((feature) => feature.geojson),
    },
    objectives: values.objectives.map((objective) => ({
      layer: objective.path,
      direction: objective.direction,
      importance: objective.importance,
    })),
    constraints: values.constraints.map((constraint) => ({
      type: constraint.type,
      layer: constraint.layer,
      min: constraint.min,
      max: constraint.max,
    })),
    neighbor_penalty: values.neighborPenaltyEnabled ? { strength: values.neighborPenaltyStrength } : null,
  };
}
