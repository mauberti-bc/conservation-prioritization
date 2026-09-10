import { TaskCreateFormValues } from 'features/home/task/create/form/TaskCreateForm';
import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import { GetTaskResponse, OPTIMIZATION_MODE, RESAMPLING } from 'hooks/interfaces/useTaskApi.interface';
import { v4 } from 'uuid';
import { getLayerDisplayName } from './layer-display';

const DEFAULT_RESOLUTION = 960;
const DEFAULT_RESAMPLING: RESAMPLING = 'mode';

/** Map one immutable run problem into editable form state. */
function mapProblem(task: GetTaskResponse, name: string): TaskCreateFormValues {
  const snapshot = task.latest_run?.input_snapshot;
  const runAreas = task.latest_run?.areas ?? [];
  const targetArea = snapshot?.target_area;
  const features =
    targetArea?.type === 'FeatureCollection' ? targetArea.features : targetArea?.type === 'Feature' ? [targetArea] : [];
  const neighborPenalty = snapshot?.neighbor_penalty;
  return {
    type: task.type ?? 'discrete_optimization',
    name,
    description: task.description ?? null,
    optimizationMode: snapshot?.optimization_mode ?? OPTIMIZATION_MODE.INTERACTIVE,
    resolution: snapshot?.planning_unit_resolution ?? task.resolution ?? DEFAULT_RESOLUTION,
    resampling: snapshot?.resampling ?? task.resampling ?? DEFAULT_RESAMPLING,
    neighborPenaltyEnabled: Boolean(neighborPenalty),
    neighborPenaltyStrength: neighborPenalty?.strength ?? 1,
    objectives: (snapshot?.objectives ?? []).map((objective) => ({
      name: getLayerDisplayName(objective.layer),
      path: objective.layer,
      direction: objective.direction,
      importance: objective.importance ?? 1,
    })),
    constraints: (snapshot?.constraints ?? []).map((constraint) => ({
      id: v4(),
      name: getLayerDisplayName(constraint.layer),
      type: constraint.type,
      layer: constraint.layer,
      min: constraint.min ?? null,
      max: constraint.max ?? null,
    })),
    targetArea: runAreas.length
      ? runAreas.map((area) => ({
          id: area.task_run_area_id,
          mapboxFeatureId: area.task_run_area_id,
          name: area.name,
          description: area.description,
          geojson: area.geojson,
        }))
      : features.map((feature, index) => ({
          id: v4(),
          mapboxFeatureId: v4(),
          name: `Area ${index + 1}`,
          description: null,
          geojson: feature as Feature<Geometry, GeoJsonProperties>,
        })),
  };
}

/** Map a task to values for a copied optimization problem. */
export const mapTaskResponseToCreateFormValues = (task: GetTaskResponse): TaskCreateFormValues => {
  return mapProblem(task, `Copy of ${task.name}`);
};

/** Map a task to values for an explicit new immutable submission. */
export const mapTaskResponseToSubmitFormValues = (task: GetTaskResponse): TaskCreateFormValues => {
  return mapProblem(task, task.name);
};
