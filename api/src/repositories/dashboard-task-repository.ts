import { SQL } from 'sql-template-strings';
import { DashboardTask, CreateDashboardTask } from '../models/dashboard-task';
import { BaseRepository } from './base-repository';

/**
 * Repository for dashboard task join operations.
 *
 * @export
 * @class DashboardTaskRepository
 * @extends {BaseRepository}
 */
export class DashboardTaskRepository extends BaseRepository {
  /**
   * Adds a task to a dashboard.
   *
   * @param {CreateDashboardTask} dashboardTask
   * @return {*}  {Promise<DashboardTask>}
   * @memberof DashboardTaskRepository
   */
  async addTaskToDashboard(dashboardTask: CreateDashboardTask): Promise<DashboardTask> {
    const sqlStatement = SQL`
      INSERT INTO dashboard_task (
        dashboard_id,
        task_id
      )
      SELECT
        ${dashboardTask.dashboard_id},
        ${dashboardTask.task_id}
      WHERE NOT EXISTS (
        SELECT 1
        FROM dashboard_task
        WHERE dashboard_id = ${dashboardTask.dashboard_id}
        AND task_id = ${dashboardTask.task_id}
        AND record_end_date IS NULL
      )
      RETURNING dashboard_task_id, dashboard_id, task_id
    `;

    const response = await this.connection.sql(sqlStatement, DashboardTask);

    if (response.rowCount > 0) {
      return response.rows[0];
    }

    const selectStatement = SQL`
      SELECT dashboard_task_id, dashboard_id, task_id
      FROM dashboard_task
      WHERE dashboard_id = ${dashboardTask.dashboard_id}
      AND task_id = ${dashboardTask.task_id}
      AND record_end_date IS NULL
    `;

    const selectResponse = await this.connection.sql(selectStatement, DashboardTask);

    return selectResponse.rows[0];
  }

  /**
   * Lists task IDs for a dashboard.
   *
   * @param {string} dashboardId
   * @return {*}  {Promise<string[]>}
   * @memberof DashboardTaskRepository
   */
  async listTaskIdsForDashboard(dashboardId: string): Promise<string[]> {
    const sqlStatement = SQL`
      SELECT task_id
      FROM dashboard_task
      WHERE dashboard_id = ${dashboardId}
      AND record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement);

    return (response.rows ?? []).map((row) => row.task_id as string);
  }
}
