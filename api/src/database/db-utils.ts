import { z } from 'zod';
import { ApiExecuteSQLError } from '../errors/api-error';

/**
 * Wraps an asynchronous function and catches any thrown exceptions,
 * parsing them into a standardized ApiExecuteSQLError.
 *
 * @param fn The async function to wrap
 * @returns A new async function that wraps the original function
 */
export const asyncErrorWrapper =
  <Args extends any[], Return>(fn: (...args: Args) => Promise<Return>) =>
  async (...args: Args): Promise<Return> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw parseError(error);
    }
  };

/**
 * Wraps a synchronous function and catches any thrown exceptions,
 * parsing them into a standardized ApiExecuteSQLError.
 *
 * @param fn The synchronous function to wrap
 * @returns A new function that wraps the original function
 */
export const syncErrorWrapper =
  <Args extends any[], Return>(fn: (...args: Args) => Return) =>
  (...args: Args): Return => {
    try {
      return fn(...args);
    } catch (error) {
      throw parseError(error);
    }
  };

/**
 * Parses an error and converts it into a human-readable ApiExecuteSQLError
 *
 * @param error The error to parse
 * @returns Throws an ApiExecuteSQLError
 */
const parseError = (error: any): never => {
  if (error instanceof z.ZodError) {
    throw new ApiExecuteSQLError('SQL response failed schema check', [error]);
  }

  if (error?.message === 'CONCURRENCY_EXCEPTION') {
    // Thrown by DB trigger based on revision_count if concurrent updates occur
    throw new ApiExecuteSQLError('Failed to update stale data', [error]);
  }

  // Generic fallback error
  throw new ApiExecuteSQLError('Failed to execute SQL', [error]);
};
