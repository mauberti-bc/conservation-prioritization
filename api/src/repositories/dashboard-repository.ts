import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateDashboard, Dashboard } from '../models/dashboard';
import { BaseRepository } from './base-repository';

/**
 * Repository for dashboard table CRUD operations.
 *
 * @export
 * @class DashboardRepository
 * @extends {BaseRepository}
 */
export class DashboardRepository extends BaseRepository {
  /**
   * Creates a new dashboard record.
   *
   * @param {CreateDashboard} dashboard
   * @return {*}  {Promise<Dashboard>}
   * @memberof DashboardRepository
   */
  async createDashboard(dashboard: CreateDashboard): Promise<Dashboard> {
    const sqlStatement = SQL`
      INSERT INTO dashboard (
        name,
        description,
        access_scheme
      ) VALUES (
        ${dashboard.name},
        ${dashboard.description ?? null},
        ${dashboard.access_scheme}
      )
      RETURNING dashboard_id, public_id, name, description, access_scheme, created_at, created_by
    `;

    const response = await this.connection.sql(sqlStatement, Dashboard);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create dashboard', [
        'DashboardRepository->createDashboard',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches a single active dashboard by its ID.
   *
   * @param {string} dashboardId
   * @return {*}  {Promise<Dashboard>}
   * @memberof DashboardRepository
   */
  async getDashboardById(dashboardId: string): Promise<Dashboard> {
    const sqlStatement = SQL`
      SELECT
        dashboard_id,
        public_id,
        name,
        description,
        access_scheme,
        created_at,
        created_by,
        updated_at,
        updated_by
      FROM dashboard
      WHERE dashboard_id = ${dashboardId}
      AND record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, Dashboard);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get dashboard by id', [
        'DashboardRepository->getDashboardById',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetches a single active dashboard by its ID, returning null if not found.
   *
   * @param {string} dashboardId
   * @return {*}  {Promise<Dashboard | null>}
   * @memberof DashboardRepository
   */
  async findDashboardById(dashboardId: string): Promise<Dashboard | null> {
    const sqlStatement = SQL`
      SELECT
        dashboard_id,
        public_id,
        name,
        description,
        access_scheme,
        created_at,
        created_by,
        updated_at,
        updated_by
      FROM dashboard
      WHERE dashboard_id = ${dashboardId}
      AND record_end_date IS NULL
    `;

    const response = await this.connection.sql(sqlStatement, Dashboard);

    if (response.rowCount !== 1) {
      return null;
    }

    return response.rows[0];
  }

  /**
   * Fetches the access scheme for a dashboard without returning metadata.
   *
   * @param {string} dashboardId
   * @return {*}  {Promise<string | null>}
   * @memberof DashboardRepository
   */
  async findDashboardAccessScheme(dashboardId: string): Promise<string | null> {
    const sqlStatement = SQL`
      SELECT access_scheme
      FROM dashboard
      WHERE dashboard_id = ${dashboardId}
      AND record_end_date IS NULL
    `;

    const response = await this.connection.sql<{ access_scheme: string }>(sqlStatement);

    if (response.rowCount !== 1) {
      return null;
    }

    return response.rows[0].access_scheme ?? null;
  }
}
