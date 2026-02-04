import * as fs from 'fs/promises';
import * as path from 'path';
import { ApiGeneralError } from '../errors/api-error';
import { LayerMeta } from '../models/layer.interface';
import { ApiPaginationOptions, ApiPaginationResults } from '../models/pagination';
import { makePaginationResponse } from '../utils/pagination';
import { parseArraysFromConsolidatedMetadata } from '../utils/zarr';

type ZarrModule = typeof import('zarrita');

/**
 * Cache entry for parsed Zarr layers.
 */
interface LayerCache {
  layers: LayerMeta[];
  loadedAt: number;
}

/**
 * Service for interacting with the Zarr data store.
 * Provides methods to list, search, and retrieve layers with pagination.
 *
 * @class LayerService
 */
export class LayerService {
  /** Lazy-loaded Zarrita module */
  private zarrModulePromise: Promise<ZarrModule> | null = null;

  /** Raw Zarr store path */
  private readonly zarrPath: string;

  /** In-memory cache for parsed Zarr layers */
  private static cache: LayerCache | null = null;

  /** Cache TTL in milliseconds (default: 5 minutes) */
  private static readonly CACHE_TTL = 5 * 60 * 1000;

  /**
   * Creates an instance of the LayerService.
   *
   * Reads and validates the ZARR_STORE_PATH environment variable.
   *
   * @memberof LayerService
   */
  constructor() {
    const raw = process.env.ZARR_STORE_PATH;

    if (!raw) {
      throw new ApiGeneralError('ZARR_STORE_PATH not defined', []);
    }

    this.zarrPath = raw.trim().replace(/^"(.*)"$/, '$1');
  }

  /**
   * Lazily loads the Zarrita module.
   *
   * @returns {Promise<ZarrModule>}
   * @private
   */
  private async getZarrModule(): Promise<ZarrModule> {
    if (!this.zarrModulePromise) {
      this.zarrModulePromise = import('zarrita');
    }

    return this.zarrModulePromise;
  }

  /**
   * Create a simple store object that reads from the local filesystem.
   * Compatible with zarrita's store interface.
   *
   * @returns {any} Store object with get() method
   * @private
   */
  private createLocalStore(): any {
    const basePath = this.zarrPath;

    return {
      get: async (key: string): Promise<ArrayBuffer | null> => {
        try {
          const filePath = path.join(basePath, key);
          const data = await fs.readFile(filePath);
          return data.buffer;
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          if (err.code === 'ENOENT') {
            return null;
          }
          throw error;
        }
      }
    };
  }

  /**
   * Load and parse all layers from the Zarr store.
   *
   * Uses an in-memory cache to avoid repeated reads of `.zmetadata`.
   *
   * @returns {Promise<LayerMeta[]>}
   * @private
   */
  private async loadAllLayers(): Promise<LayerMeta[]> {
    const now = Date.now();

    if (LayerService.cache && now - LayerService.cache.loadedAt < LayerService.CACHE_TTL) {
      return LayerService.cache.layers;
    }

    const zarr = await this.getZarrModule();
    const store = this.createLocalStore();
    const location = zarr.root(store);

    // Resolve consolidated metadata path
    const metadataPath = location.resolve('.zmetadata').path;

    let consolidatedMetadata: unknown;

    try {
      const metadataBytes = await store.get(metadataPath);

      if (!metadataBytes) {
        throw new Error('No metadata bytes returned from Zarr store');
      }

      consolidatedMetadata = JSON.parse(new TextDecoder().decode(metadataBytes));
    } catch (error) {
      throw new ApiGeneralError('Failed to read consolidated Zarr metadata', [
        { label: 'LayerService.loadAllLayers', error }
      ]);
    }

    const metadataRecord = (consolidatedMetadata as { metadata?: unknown }).metadata;

    if (!metadataRecord || typeof metadataRecord !== 'object') {
      throw new ApiGeneralError('Invalid consolidated Zarr metadata payload', [
        { label: 'LayerService.loadAllLayers' }
      ]);
    }

    const layers = parseArraysFromConsolidatedMetadata(metadataRecord as Record<string, unknown>).sort((a, b) =>
      a.path.localeCompare(b.path)
    );

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
   * @returns {Promise<{ layers: LayerMeta[]; pagination: ApiPaginationResults }>}
   * @memberof LayerService
   */
  async listLayers(pagination: ApiPaginationOptions): Promise<{
    layers: LayerMeta[];
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
   * @returns {Promise<{ layers: LayerMeta[]; pagination: ApiPaginationResults | null }>}
   * @memberof LayerService
   */
  async findLayers(
    searchTerm: string,
    pagination?: ApiPaginationOptions
  ): Promise<{
    layers: LayerMeta[];
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
   * @returns {Promise<LayerMeta | null>}
   * @memberof LayerService
   */
  async getLayerByPath(path: string): Promise<LayerMeta | null> {
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
