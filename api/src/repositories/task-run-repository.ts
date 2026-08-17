import { SQL, SQLStatement } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateTaskRun, TaskRun, UpdateTaskRun } from '../models/task-run';
import { BaseRepository } from './base-repository';

const TASK_RUN_COLUMNS = `
  task_run_id, task_id, task_type, analytical_source_id, execution_method,
  execution_method_version, status, stage, revision,
  input_snapshot, input_hash, planning_unit_definition, solver_config,
  code_version, solver_name, solver_version, solver_status, objective_value, optimality_gap, runtime_seconds,
  preliminary_estimate, admission_outcome, progress, planning_unit_count,
  feature_nonzero_count, neighbor_edge_count,
  prefect_flow_run_id, prefect_deployment_id, dispatch_attempts,
  failure_code, failure_message, started_at, completed_at, failed_at, cancelled_at,
  created_at, updated_at
`;

/** Repository for immutable task runs and lifecycle updates. */
export class TaskRunRepository extends BaseRepository {
  /**
   * Creates a queued immutable task run.
   *
   * @param {CreateTaskRun} run Run snapshot.
   * @returns {Promise<TaskRun>}
   */
  async createTaskRun(run: CreateTaskRun): Promise<TaskRun> {
    const response = await this.connection.sql(
      SQL`INSERT INTO task_run (
            task_id, task_type, analytical_source_id, execution_method, execution_method_version,
            input_snapshot, input_hash,
            planning_unit_definition, solver_config, code_version
          ) VALUES (
            ${run.task_id}, ${run.task_type}, ${run.analytical_source_id},
            ${run.execution_method}, ${run.execution_method_version},
            ${JSON.stringify(run.input_snapshot)}::jsonb,
            ${run.input_hash}, ${JSON.stringify(run.planning_unit_definition)}::jsonb,
            ${JSON.stringify(run.solver_config)}::jsonb, ${run.code_version}
          ) RETURNING `.append(TASK_RUN_COLUMNS),
      TaskRun
    );

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create task run', ['TaskRunRepository->createTaskRun']);
    }

    return response.rows[0];
  }

  /** Returns a run by ID. */
  async getTaskRunById(taskRunId: string): Promise<TaskRun> {
    const response = await this.connection.sql(
      SQL`SELECT `.append(TASK_RUN_COLUMNS).append(SQL` FROM task_run WHERE task_run_id = ${taskRunId}`),
      TaskRun
    );
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to fetch task run', ['TaskRunRepository->getTaskRunById']);
    }
    return response.rows[0];
  }

  /** Locks and returns a queued run so concurrent dispatch recovery cannot submit it twice. */
  async getTaskRunForDispatch(taskRunId: string): Promise<TaskRun> {
    const response = await this.connection.sql(
      SQL`SELECT `.append(TASK_RUN_COLUMNS).append(SQL` FROM task_run WHERE task_run_id = ${taskRunId} FOR UPDATE`),
      TaskRun
    );
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to lock task run for dispatch', [
        'TaskRunRepository->getTaskRunForDispatch'
      ]);
    }
    return response.rows[0];
  }

  /** Returns runs for a task newest first. */
  async getTaskRunsByTaskId(taskId: string): Promise<TaskRun[]> {
    const response = await this.connection.sql(
      SQL`SELECT `
        .append(TASK_RUN_COLUMNS)
        .append(SQL` FROM task_run WHERE task_id = ${taskId} ORDER BY created_at DESC`),
      TaskRun
    );
    return response.rows;
  }

  /** Returns the latest run for a task. */
  async getLatestTaskRunByTaskId(taskId: string): Promise<TaskRun | null> {
    const runs = await this.connection.sql(
      SQL`SELECT `.append(TASK_RUN_COLUMNS).append(SQL`
        FROM task_run WHERE task_id = ${taskId} ORDER BY created_at DESC LIMIT 1`),
      TaskRun
    );
    return runs.rows[0] ?? null;
  }

  /** Applies validated lifecycle and solver metadata updates. */
  async updateTaskRun(taskRunId: string, updates: UpdateTaskRun): Promise<TaskRun> {
    const statement = SQL`UPDATE task_run SET revision = revision + 1, updated_at = now()`;
    const fields: SQLStatement[] = [];
    if (updates.status !== undefined) {
      fields.push(SQL`status = ${updates.status}`);
    }
    if (updates.stage !== undefined) {
      fields.push(SQL`stage = ${updates.stage}`);
    }
    if (updates.solver_status !== undefined) {
      fields.push(SQL`solver_status = ${updates.solver_status}`);
    }
    if (updates.solver_name !== undefined) {
      fields.push(SQL`solver_name = ${updates.solver_name}`);
    }
    if (updates.solver_version !== undefined) {
      fields.push(SQL`solver_version = ${updates.solver_version}`);
    }
    if (updates.objective_value !== undefined) {
      fields.push(SQL`objective_value = ${updates.objective_value}`);
    }
    if (updates.optimality_gap !== undefined) {
      fields.push(SQL`optimality_gap = ${updates.optimality_gap}`);
    }
    if (updates.runtime_seconds !== undefined) {
      fields.push(SQL`runtime_seconds = ${updates.runtime_seconds}`);
    }
    if (updates.preliminary_estimate !== undefined) {
      fields.push(SQL`preliminary_estimate = ${JSON.stringify(updates.preliminary_estimate)}::jsonb`);
    }
    if (updates.admission_outcome !== undefined) {
      fields.push(SQL`admission_outcome = ${JSON.stringify(updates.admission_outcome)}::jsonb`);
    }
    if (updates.progress !== undefined) {
      fields.push(SQL`progress = ${JSON.stringify(updates.progress)}::jsonb`);
    }
    if (updates.planning_unit_count !== undefined) {
      fields.push(SQL`planning_unit_count = ${updates.planning_unit_count}`);
    }
    if (updates.feature_nonzero_count !== undefined) {
      fields.push(SQL`feature_nonzero_count = ${updates.feature_nonzero_count}`);
    }
    if (updates.neighbor_edge_count !== undefined) {
      fields.push(SQL`neighbor_edge_count = ${updates.neighbor_edge_count}`);
    }
    if (updates.prefect_flow_run_id !== undefined) {
      fields.push(SQL`prefect_flow_run_id = ${updates.prefect_flow_run_id}`);
    }
    if (updates.prefect_deployment_id !== undefined) {
      fields.push(SQL`prefect_deployment_id = ${updates.prefect_deployment_id}`);
    }
    if (updates.failure_code !== undefined) {
      fields.push(SQL`failure_code = ${updates.failure_code}`);
    }
    if (updates.failure_message !== undefined) {
      fields.push(SQL`failure_message = ${updates.failure_message}`);
    }

    for (const field of fields) {
      statement.append(SQL`, `).append(field);
    }

    if (updates.status === 'running') {
      statement.append(
        SQL`, started_at = COALESCE(started_at, now()), failed_at = NULL, failure_code = NULL, failure_message = NULL`
      );
    }
    if (updates.status === 'completed') {
      statement.append(SQL`, completed_at = now(), failed_at = NULL, failure_code = NULL, failure_message = NULL`);
    }
    if (updates.status === 'failed') {
      statement.append(SQL`, failed_at = now()`);
    }
    if (updates.status === 'cancelled') {
      statement.append(SQL`, cancelled_at = now()`);
    }

    statement.append(SQL` WHERE task_run_id = ${taskRunId} RETURNING `).append(TASK_RUN_COLUMNS);
    const response = await this.connection.sql(statement, TaskRun);
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update task run', ['TaskRunRepository->updateTaskRun']);
    }
    return response.rows[0];
  }

  /** Increments dispatch attempts for recoverable Prefect submission. */
  async recordDispatchAttempt(taskRunId: string): Promise<void> {
    await this.connection.sql(
      SQL`UPDATE task_run SET dispatch_attempts = dispatch_attempts + 1 WHERE task_run_id = ${taskRunId}`
    );
  }
}
