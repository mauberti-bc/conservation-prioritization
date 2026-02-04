import type { CreateTaskLayerRequest, CreateTaskRequest } from '../models/task-orchestrator';
import type { OptimizationLayer, OptimizationParameters } from '../services/prefect-service.interface';

/**
 * Builds optimization parameters for Prefect flow runs from a task creation request.
 *
 * @param {CreateTaskRequest} request - Task creation request payload.
 * @return {*} {OptimizationParameters} Optimization parameters for Prefect.
 */
export const buildOptimizationParameters = (request: CreateTaskRequest): OptimizationParameters => {
  const layers: Record<string, OptimizationLayer> = {};

  const addLayer = (layer: CreateTaskLayerRequest) => {
    layers[layer.layer_name] = {
      mode: layer.mode,
      importance: layer.importance ?? undefined,
      threshold: layer.threshold ?? undefined,
      constraints: layer.constraints ?? []
    };
  };

  request.layers.forEach(addLayer);

  if (request.budget) {
    addLayer(request.budget);
  }

  return {
    resolution: request.resolution ?? 1000,
    resampling: request.resampling ?? 'mode',
    layers
  };
};
