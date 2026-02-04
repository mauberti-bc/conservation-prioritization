import { IDBConnection } from '../database/db';
import { CreateGeometry, Geometry } from '../models/geometry';
import { GeometryRepository } from '../repositories/geometry-repository';
import { DBService } from './db-service';

/**
 * Service for managing geometry records.
 *
 * @export
 * @class GeometryService
 * @extends {DBService}
 */
export class GeometryService extends DBService {
  private geometryRepository: GeometryRepository;

  /**
   * Creates an instance of GeometryService.
   *
   * @param {IDBConnection} connection - The database connection object.
   * @memberof GeometryService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.geometryRepository = new GeometryRepository(connection);
  }

  /**
   * Creates a geometry record from a GeoJSON input.
   *
   * @param {CreateGeometry} geometry
   * @return {*}  {Promise<Geometry>}
   * @memberof GeometryService
   */
  async createGeometry(geometry: CreateGeometry): Promise<Geometry> {
    const geojson = this.normalizeGeojson(geometry.geojson);
    return this.geometryRepository.createGeometry({ ...geometry, geojson });
  }

  private normalizeGeojson(geojson: unknown): unknown {
    if (geojson && typeof geojson === 'object' && 'geometry' in geojson) {
      const value = geojson as { geometry?: unknown };
      if (value.geometry) {
        return value.geometry;
      }
    }

    return geojson;
  }
}
