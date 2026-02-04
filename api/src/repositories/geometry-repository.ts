import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateGeometry, Geometry } from '../models/geometry';
import { BaseRepository } from './base-repository';

/**
 * Repository for geometry table CRUD operations.
 *
 * @export
 * @class GeometryRepository
 * @extends {BaseRepository}
 */
export class GeometryRepository extends BaseRepository {
  /**
   * Creates a new geometry record.
   *
   * @param {CreateGeometry} geometry - The geometry payload to insert.
   * @return {*} {Promise<Geometry>} The created geometry record.
   * @memberof GeometryRepository
   */
  async createGeometry(geometry: CreateGeometry): Promise<Geometry> {
    const geojson = JSON.stringify(geometry.geojson);

    const sqlStatement = SQL`
      INSERT INTO geometry (
        name,
        description,
        geometry
      ) VALUES (
        ${geometry.name},
        ${geometry.description},
        ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326)
      )
      RETURNING
        geometry_id,
        name,
        description,
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geometry)::json,
          'properties', jsonb_build_object()
        ) AS geojson
    `;

    const response = await this.connection.sql(sqlStatement, Geometry);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create geometry', [
        'GeometryRepository->createGeometry',
        'Expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
}
