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
      ) VALUES (
        ${permission.dashboard_id},
        ${permission.profile_id},
        ${permission.role_id}
      )
      ON CONFLICT (dashboard_id, profile_id) DO UPDATE
      SET role_id = EXCLUDED.role_id,
          record_end_date = NULL
      RETURNING dashboard_permission_id, dashboard_id, profile_id, role_id
    `;

    const response = await this.connection.sql(sqlStatement, DashboardPermission);

    return response.rows?.[0] ?? null;
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
