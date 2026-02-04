import { CreateTaskLayerRequest, CreateTaskRequest } from '../models/task-orchestrator';
import { OptimizationLayer, OptimizationParameters } from '../services/prefect-service.interface';

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

  const parameters: OptimizationParameters = {
    resolution: request.resolution ?? 1000,
    resampling: request.resampling ?? 'mode',
    layers,
    target_area: request.target_area ?? 50,
    is_percentage: request.is_percentage ?? true
  };

  if (request.geometry && request.geometry.length > 0) {
    parameters.geometry = request.geometry.map((item) => ({
      geojson: item.geojson
    }));
  }

  return parameters;
};
