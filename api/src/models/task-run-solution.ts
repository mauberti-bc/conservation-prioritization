import { z } from 'zod';

export const TaskRunSolutionRole = z.literal('reference');
export type TaskRunSolutionRole = z.infer<typeof TaskRunSolutionRole>;

/** The immutable reference result belonging to a task run. */
export const TaskRunSolution = z.object({
  task_run_solution_id: z.string().uuid(),
  task_run_id: z.string().uuid(),
  solution_index: z.number().int().nonnegative(),
  role: TaskRunSolutionRole,
  status: z.string(),
  objective_value: z.coerce.number().nullable(),
  resource_value: z.coerce.number().nullable(),
  selected_planning_unit_count: z.coerce.number().int().nullable(),
  optimality_gap: z.coerce.number().nullable(),
  solver_name: z.string().nullable(),
  solver_version: z.string().nullable(),
  runtime_seconds: z.coerce.number().nullable(),
  metrics: z.record(z.unknown()),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.string().uuid().nullable()
});

export type TaskRunSolution = z.infer<typeof TaskRunSolution>;

export interface UpsertTaskRunSolution {
  solution_index: number;
  role: TaskRunSolutionRole;
  status: string;
  objective_value?: number | null;
  resource_value?: number | null;
  selected_planning_unit_count?: number | null;
  optimality_gap?: number | null;
  solver_name?: string | null;
  solver_version?: string | null;
  runtime_seconds?: number | null;
  metrics?: Record<string, unknown>;
}
