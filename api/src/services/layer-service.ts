import * as zarr from 'zarrita';
import { ApiGeneralError } from '../errors/api-error';
import { ApiPaginationOptions, ApiPaginationResults } from '../models/pagination';
import { makePaginationResponse } from '../utils/pagination';

/**
 * Cache entry for parsed Zarr layers
 */
interface LayerCache {
  layers: ZarrArrayMeta[];
  loadedAt: number;
}

/**
 * Service for interacting with the Zarr data store.
 * Provides methods to list, search, and retrieve layers with pagination.
 *
 * @class LayerService
 */
export class LayerService {
  private store: zarr.FetchStore;

  /** In-memory cache for parsed Zarr layers */
  private static cache: LayerCache | null = null;

  /** Cache TTL in milliseconds (default: 5 minutes) */
  private static readonly CACHE_TTL = 5 * 60 * 1000;

  /**
   * Creates an instance of the LayerService.
   *
   * @memberof LayerService
   */
  constructor() {
    const zarrUrl = process.env.ZARR_STORE_PATH;

    if (!zarrUrl) {
      throw new ApiGeneralError('Zarr URL not defined', []);
    }

    this.store = new zarr.FetchStore(zarrUrl);
  }

  /**
   * Load and parse all layers from the Zarr store.
   * Uses an in-memory cache to avoid repeated downloads of `.zmetadata`.
   *
   * @returns {Promise<ZarrArrayMeta[]>}
   * @private
   */
  private async loadAllLayers(): Promise<ZarrArrayMeta[]> {
    const now = Date.now();

    if (LayerService.cache && now - LayerService.cache.loadedAt < LayerService.CACHE_TTL) {
      return LayerService.cache.layers;
    }

    const location = zarr.root(this.store);
    const metadataPath = location.resolve('.zmetadata').path;

    const consolidatedMetadata = JSON.parse(new TextDecoder().decode(await this.store.get(metadataPath)));

    const layers = parseArraysFromConsolidatedMetadata(consolidatedMetadata.metadata);

    LayerService.cache = {
      layers,
      loadedAt: now
    };

    return layers;
  }

  /**
   * Fetch all layers with pagination.
   *
   * @param {ApiPaginationOptions} pagination Pagination options
   * @returns {Promise<{ layers: ZarrArrayMeta[]; pagination: ApiPaginationResults }>}
   * @memberof LayerService
   */
  async listLayers(pagination: ApiPaginationOptions): Promise<{
    layers: ZarrArrayMeta[];
    pagination: ApiPaginationResults;
  }> {
    const allLayers = await this.loadAllLayers();
    const total = allLayers.length;

    const paginatedLayers = this.paginate(allLayers, pagination);

    return {
      layers: paginatedLayers,
      pagination: makePaginationResponse(total, pagination)
    };
  }

  /**
   * Search for layers by keyword with pagination.
   * Matches against name, path, and description (case-insensitive).
   *
   * @param {string} searchTerm Optional search term
   * @param {ApiPaginationOptions} pagination Pagination options
   * @returns {Promise<{ layers: ZarrArrayMeta[]; pagination: ApiPaginationResults }>}
   * @memberof LayerService
   */
  async findLayers(
    searchTerm: string,
    pagination?: ApiPaginationOptions
  ): Promise<{
    layers: ZarrArrayMeta[];
    pagination: ApiPaginationResults | null;
  }> {
    const allLayers = await this.loadAllLayers();

    const filteredLayers = searchTerm
      ? allLayers.filter((layer) => {
          const search = searchTerm.toLowerCase();
          return (
            layer.name.toLowerCase().includes(search) ||
            layer.path.toLowerCase().includes(search) ||
            layer.description?.toLowerCase().includes(search)
          );
        })
      : allLayers;

    const total = filteredLayers.length;

    if (pagination) {
      const paginatedLayers = this.paginate(filteredLayers, pagination);
      return {
        layers: paginatedLayers,
        pagination: makePaginationResponse(total, pagination)
      };
    }

    return {
      layers: filteredLayers,
      pagination: null
    };
  }

  /**
   * Fetch metadata for a specific layer by its path.
   *
   * @param {string} path Layer path (e.g. "landcover/disturbance/mining")
   * @returns {Promise<ZarrArrayMeta | null>}
   * @memberof LayerService
   */
  async getLayerByPath(path: string): Promise<ZarrArrayMeta | null> {
    const layers = await this.loadAllLayers();
    return layers.find((layer) => layer.path === path) ?? null;
  }

  /**
   * Apply pagination to an array of items.
   *
   * @template T
   * @param {T[]} items Items to paginate
   * @param {ApiPaginationOptions} pagination Pagination options
   * @returns {T[]} Paginated items
   * @private
   */
  private paginate<T>(items: T[], pagination: ApiPaginationOptions): T[] {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    return items.slice(offset, offset + limit);
  }
}
