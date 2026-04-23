import { ApiGeneralError } from '../errors/api-error';
import { LayerMeta } from '../models/layer.interface';
import { ApiPaginationOptions, ApiPaginationResults } from '../models/pagination';
import { getFileFromS3 } from '../utils/file-utils';
import { makePaginationResponse } from '../utils/pagination';
import { parseArraysFromConsolidatedMetadata } from '../utils/zarr';

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
 * This implementation reads consolidated metadata directly from `.zmetadata`
 * and does not depend on `zarrita`.
 *
 * @class LayerService
 */
export class LayerService {
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
   * Expected format:
   * `path/to/store.zarr`
   *
   * Example:
   * `data/output_1000.zarr`
   *
   * Bucket and object-store connection details are resolved by `file-utils`.
   *
   * @memberof LayerService
   */
  constructor() {
    const raw = process.env.ZARR_STORE_PATH;

    if (!raw) {
      throw new ApiGeneralError('ZARR_STORE_PATH not defined', []);
    }

    this.zarrPath = raw
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .replace(/^\/+|\/+$/g, '');

    if (!this.zarrPath) {
      throw new ApiGeneralError('ZARR_STORE_PATH must not be empty', []);
    }
  }

  /**
   * Join a base Zarr path and relative key into a normalized object-store key.
   *
   * @param {string} prefix Base Zarr path
   * @param {string} key Relative key
   * @returns {string}
   * @private
   */
  private joinObjectKey(prefix: string, key: string): string {
    const normalizedPrefix = prefix.replace(/\/+$/g, '');
    const normalizedKey = key.replace(/^\/+/g, '');

    return normalizedPrefix ? `${normalizedPrefix}/${normalizedKey}` : normalizedKey;
  }

  /**
   * Create a simple store object that reads from the remote object store.
   *
   * @returns {{ get: (key: string) => Promise<ArrayBuffer | null> }} Store object with get() method
   * @private
   */
  private createRemoteStore(): { get: (key: string) => Promise<ArrayBuffer | null> } {
    const prefix = this.zarrPath;

    return {
      get: async (key: string): Promise<ArrayBuffer | null> => {
        const fullKey = this.joinObjectKey(prefix, key);

        try {
          console.log('[LayerService] Reading Zarr object', {
            zarrPath: this.zarrPath,
            key,
            fullKey
          });

          const response = await getFileFromS3(fullKey);

          if (!response.Body) {
            throw new Error(`S3 response body was empty for key: ${fullKey}`);
          }

          const bytes = await response.Body.transformToByteArray();

          if (!bytes.byteLength) {
            throw new Error(`S3 response body had zero bytes for key: ${fullKey}`);
          }

          const copy = new Uint8Array(bytes.byteLength);
          copy.set(bytes);

          return copy.buffer;
        } catch (error) {
          const awsError = error as {
            name?: string;
            Code?: string;
            code?: string;
            message?: string;
            $metadata?: { httpStatusCode?: number; requestId?: string; extendedRequestId?: string };
          };

          console.error('[LayerService] Failed reading Zarr object', {
            zarrPath: this.zarrPath,
            key,
            fullKey,
            errorName: awsError.name,
            errorCode: awsError.Code ?? awsError.code,
            statusCode: awsError.$metadata?.httpStatusCode,
            requestId: awsError.$metadata?.requestId,
            message: awsError.message
          });

          if (key !== '.zmetadata' && (awsError.name === 'NoSuchKey' || awsError.$metadata?.httpStatusCode === 404)) {
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

    const store = this.createRemoteStore();
    const metadataPath = '.zmetadata';

    let consolidatedMetadata: unknown;

    try {
      const metadataBytes = await store.get(metadataPath);

      console.log('metadata:', metadataBytes, 'store: ', store);

      if (!metadataBytes) {
        throw new Error(
          `No metadata bytes returned from Zarr store at key: ${this.joinObjectKey(this.zarrPath, metadataPath)}`
        );
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
   * Matches against name, path, and description.
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
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filteredLayers = normalizedSearch
      ? allLayers.filter((layer) => {
          return (
            layer.name.toLowerCase().includes(normalizedSearch) ||
            layer.path.toLowerCase().includes(normalizedSearch) ||
            layer.description?.toLowerCase().includes(normalizedSearch)
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
   * @param {string} layerPath Layer path (e.g. "landcover/disturbance/mining")
   * @returns {Promise<LayerMeta | null>}
   * @memberof LayerService
   */
  async getLayerByPath(layerPath: string): Promise<LayerMeta | null> {
    const layers = await this.loadAllLayers();

    return layers.find((layer) => layer.path === layerPath) ?? null;
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
