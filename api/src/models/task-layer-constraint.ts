import { z } from 'zod';

/**
 * TaskLayerConstraint model representing constraints associated with a task layer.
 */
export const TaskLayerConstraint = z.object({
  task_layer_constraint_id: z.string().uuid(),
  task_layer_id: z.string().uuid(),
  constraint_name: z.string().max(100),
  constraint_value: z.string().max(500).nullable()
});

export type TaskLayerConstraint = z.infer<typeof TaskLayerConstraint>;

/** Type for creating a new task layer constraint */
export const CreateTaskLayerConstraint = z.object({
  task_layer_id: z.string().uuid(),
  constraint_name: z.string().max(100),
  constraint_value: z.string().max(500).nullable()
});

export type CreateTaskLayerConstraint = z.infer<typeof CreateTaskLayerConstraint>;

/** Type for deleting a task layer constraint */
export const DeleteTaskLayerConstraint = z.object({
  task_layer_constraint_id: z.string().uuid()
});

export type DeleteTaskLayerConstraint = z.infer<typeof DeleteTaskLayerConstraint>;
