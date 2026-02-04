import { SQL } from 'sql-template-strings';
import { DashboardPermission, CreateDashboardPermission } from '../models/dashboard-permission';
import { BaseRepository } from './base-repository';

/**
 * Repository for dashboard permission operations.
 *
 * @export
 * @class DashboardPermissionRepository
 * @extends {BaseRepository}
 */
export class DashboardPermissionRepository extends BaseRepository {
  /**
   * Upserts a dashboard permission.
   *
   * @param {CreateDashboardPermission} permission
   * @return {*}  {Promise<DashboardPermission | null>}
   * @memberof DashboardPermissionRepository
   */
  async upsertDashboardPermission(permission: CreateDashboardPermission): Promise<DashboardPermission | null> {
    const sqlStatement = SQL`
      INSERT INTO dashboard_permission (
        dashboard_id,
        profile_id,
        role_id
      )
      SELECT
        ${permission.dashboard_id},
        ${permission.profile_id},
        ${permission.role_id}
      WHERE NOT EXISTS (
        SELECT 1
        FROM dashboard_permission
        WHERE dashboard_id = ${permission.dashboard_id}
        AND profile_id = ${permission.profile_id}
        AND record_end_date IS NULL
      )
      RETURNING dashboard_permission_id, dashboard_id, profile_id, role_id
    `;

    const response = await this.connection.sql(sqlStatement, DashboardPermission);

    if (response.rowCount > 0) {
      return response.rows[0];
    }

    const selectStatement = SQL`
      SELECT dashboard_permission_id, dashboard_id, profile_id, role_id
      FROM dashboard_permission
      WHERE dashboard_id = ${permission.dashboard_id}
      AND profile_id = ${permission.profile_id}
      AND record_end_date IS NULL
    `;

    const selectResponse = await this.connection.sql(selectStatement, DashboardPermission);

    return selectResponse.rows?.[0] ?? null;
  }

  /**
   * Fetches a dashboard permission by dashboard/profile.
   *
   * @param {string} dashboardId
   * @param {string} profileId
   * @return {*}  {Promise<DashboardPermission | null>}
   * @memberof DashboardPermissionRepository
   */
  async getDashboardPermission(dashboardId: string, profileId: string): Promise<DashboardPermission | null> {
    const sqlStatement = SQL`
      SELECT dashboard_permission_id, dashboard_id, profile_id, role_id
      FROM dashboard_permission
      WHERE dashboard_id = ${dashboardId}
      AND profile_id = ${profileId}
      AND record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, DashboardPermission);

    if (!response.rowCount) {
      return null;
    }

    return response.rows[0];
  }
}
