import { Request } from 'express';
import { ApiPaginationOptions, ApiPaginationResults } from '../models/pagination';

const toNumber = (value: unknown): number | undefined =>
  typeof value === 'string' || typeof value === 'number' ? Number(value) : undefined;

/**
 * Shared pagination extractor from a generic object.
 * Works with query params or body params.
 *
 * @param {Record<string, unknown>} source - Object containing pagination keys
 * @returns {Partial<ApiPaginationOptions>} Make pagination options from source.
 */
const makePaginationOptionsFromSource = (source: Record<string, unknown>): Partial<ApiPaginationOptions> => {
  const page = toNumber(source.page);
  const limit = toNumber(source.limit);

  const order =
    typeof source.order === 'string' && (source.order.toLowerCase() === 'asc' || source.order.toLowerCase() === 'desc')
      ? (source.order.toLowerCase() as 'asc' | 'desc')
      : undefined;

  const sort = typeof source.sort === 'string' ? source.sort : undefined;

  return {
    page: page ?? 1,
    limit: limit ?? 25,
    sort: sort ?? 'created_at',
    order: order ?? 'desc'
  };
};

/**
 * Extracts pagination from query parameters
 *
 * @param {Request} request Request containing the input fields to process.
 * @returns {Partial<ApiPaginationOptions>} Make pagination options from request.
 */
export const makePaginationOptionsFromRequest = (request: Request): Partial<ApiPaginationOptions> => {
  return makePaginationOptionsFromSource(request.query);
};

/**
 * Extracts pagination from request body
 *
 * @param {Request} request Request containing the input fields to process.
 * @returns {Partial<ApiPaginationOptions>} Make pagination options from body.
 */
export const makePaginationOptionsFromBody = (request: Request): Partial<ApiPaginationOptions> => {
  return makePaginationOptionsFromSource(request.body.pagination ?? {});
};

/**
 * Generates the pagination response object from the given pagination request params.
 *
 * Used in conjunction with a the output of `makePaginationOptionsFromRequest`.
 *
 * @param {number} total Total number of available records.
 * @param {Partial<ApiPaginationOptions>} pagination Page, page-size, and sorting options.
 * @returns {ApiPaginationResults} Make pagination response.
 */
export const makePaginationResponse = (
  total: number,
  pagination?: Partial<ApiPaginationOptions>
): ApiPaginationResults => {
  return {
    total,
    per_page: pagination?.limit ?? total,
    current_page: pagination?.page ?? 1,
    last_page: pagination?.limit ? Math.max(1, Math.ceil(total / pagination.limit)) : 1,
    sort: pagination?.sort,
    order: pagination?.order
  };
};

/**
 * Returns `ApiPaginationOptions` if the given pagination object contains all of the necessary request params needed to
 * facilitate pagination, otherwise returns `undefined`.
 *
 * Used in conjunction with the output of `makePaginationOptionsFromRequest`.
 *
 * @param {Partial<ApiPaginationOptions>} pagination Page, page-size, and sorting options.
 * @returns {boolean} `ApiPaginationOptions` if the given pagination object contains all of the necessary request params needed to
 * facilitate pagination, otherwise returns `undefined`.
 * Used in conjunction with the output of `makePaginationOptionsFromRequest`.
 */
export const ensureCompletePaginationOptions = (
  pagination: Partial<ApiPaginationOptions>
): ApiPaginationOptions | undefined => {
  if (pagination.limit !== undefined && pagination.page !== undefined) {
    return {
      limit: pagination.limit,
      page: pagination.page,
      order: pagination.order,
      sort: pagination.sort
    };
  }

  return undefined;
};
