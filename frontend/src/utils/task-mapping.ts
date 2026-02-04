import { TaskCreateFormValues } from 'features/home/task/create/form/TaskCreateForm';
import { GetTaskResponse, OPTIMIZATION_VARIANT, RESAMPLING } from 'hooks/interfaces/useTaskApi.interface';
import { v4 } from 'uuid';

const DEFAULT_RESOLUTION = 1000;
const DEFAULT_RESAMPLING: RESAMPLING = 'mode';
const DEFAULT_VARIANT = OPTIMIZATION_VARIANT.STRICT;

/**
 * Maps a task response to initial values for creating a new task.
 *
 * @param {GetTaskResponse} task - Source task to copy.
 * @return {TaskCreateFormValues} Form values for initializing the create task form.
 */
export const mapTaskResponseToCreateFormValues = (task: GetTaskResponse): TaskCreateFormValues => {
  return {
    name: `Copy of ${task.name}`,
    description: task.description ?? null,
    variant: task.variant ?? DEFAULT_VARIANT,
    resolution: task.resolution ?? DEFAULT_RESOLUTION,
    resampling: task.resampling ?? DEFAULT_RESAMPLING,
    budget: null,
    layers: task.layers.map((layer) => ({
      name: layer.layer_name,
      path: layer.layer_name,
      mode: layer.mode,
      importance: layer.importance ?? undefined,
      threshold: layer.threshold ?? undefined,
      constraints: layer.constraints.map((constraint) => ({
        id: v4(),
        min: constraint.min ?? null,
        max: constraint.max ?? null,
        type: constraint.type,
      })),
    })),
    geometry: [],
  };
};
