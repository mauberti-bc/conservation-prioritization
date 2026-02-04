import { Task } from './task';
import { TaskLayer } from './task-layer';
import { TaskLayerConstraint } from './task-layer-constraint';

/**
 * Task layer including its configured constraints.
 */
export interface TaskLayerWithConstraints extends TaskLayer {
  constraints: TaskLayerConstraint[];
}

/**
 * Task including its configured layers and constraints.
 */
export interface TaskWithLayers extends Task {
  layers: TaskLayerWithConstraints[];
}
