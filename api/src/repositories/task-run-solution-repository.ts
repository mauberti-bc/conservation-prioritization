import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { TaskRunSolution, UpsertTaskRunSolution } from '../models/task-run-solution';
import { BaseRepository } from './base-repository';

const SOLUTION_COLUMNS = `task_run_solution_id, task_run_id, solution_index, role, status,
  objective_value, resource_value, selected_planning_unit_count, optimality_gap,
  solver_name, solver_version,
  runtime_seconds, metrics, created_at, created_by, updated_at, updated_by`;

/** Repository for normalized run solution metadata. */
export class TaskRunSolutionRepository extends BaseRepository {
  /** Creates or updates one solution at its stable run-local index. */
  async upsertTaskRunSolution(taskRunId: string, solution: UpsertTaskRunSolution): Promise<TaskRunSolution> {
    const response = await this.connection.sql(
      SQL`INSERT INTO task_run_solution (
            task_run_id, solution_index, role, status, objective_value, resource_value,
            selected_planning_unit_count, optimality_gap,
            solver_name, solver_version, runtime_seconds, metrics
          ) VALUES (
            ${taskRunId}, ${solution.solution_index}, ${solution.role}, ${solution.status},
            ${solution.objective_value ?? null}, ${solution.resource_value ?? null},
            ${solution.selected_planning_unit_count ?? null}, ${solution.optimality_gap ?? null},
            ${solution.solver_name ?? null}, ${solution.solver_version ?? null},
            ${solution.runtime_seconds ?? null}, ${JSON.stringify(solution.metrics ?? {})}::jsonb
          ) ON CONFLICT (task_run_id, solution_index) DO UPDATE SET
            role = EXCLUDED.role,
            status = EXCLUDED.status,
            objective_value = EXCLUDED.objective_value,
            resource_value = EXCLUDED.resource_value,
            selected_planning_unit_count = EXCLUDED.selected_planning_unit_count,
            optimality_gap = EXCLUDED.optimality_gap,
            solver_name = EXCLUDED.solver_name,
            solver_version = EXCLUDED.solver_version,
            runtime_seconds = EXCLUDED.runtime_seconds,
            metrics = EXCLUDED.metrics,
            updated_at = now()
          RETURNING `.append(SOLUTION_COLUMNS),
      TaskRunSolution
    );
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to upsert task run solution', [
        'TaskRunSolutionRepository->upsertTaskRunSolution'
      ]);
    }
    return response.rows[0];
  }

  /** Lists solutions in stable run-local order. */
  async getTaskRunSolutions(taskRunId: string): Promise<TaskRunSolution[]> {
    const response = await this.connection.sql(
      SQL`SELECT `
        .append(SOLUTION_COLUMNS)
        .append(SQL` FROM task_run_solution WHERE task_run_id = ${taskRunId} ORDER BY solution_index`),
      TaskRunSolution
    );
    return response.rows;
  }
}
