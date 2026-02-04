import { useCallback, useRef } from 'react';

export type AsyncFunction<AFArgs extends any[], AFResponse> = (...args: AFArgs) => Promise<AFResponse>;

/**
 * Wraps an async function to prevent duplicate calls if the previous call is still pending.
 *
 * Example:
 *
 * ```
 * const myAsyncFunction = useAsync(
 *   (param: number) => asyncFunction(param1)
 * )
 *
 * await myAsyncFunction(1) // calls `asyncFunction`, where param=1
 * // call 1 is pending
 * await myAsyncFunction(2) // returns pending promise from call 1
 * await myAsyncFunction(2) // returns pending promise from call 1
 * // call 1 is fulfilled
 * await myAsyncFunction(2) // calls `asyncFunction`, where param=2
 * // call 2 is pending
 * ```
 *
 * @template AFArgs `AsyncFunction` argument types.
 * @template AFResponse `AsyncFunction` response type.
 * @param {AsyncFunction<AFArgs, AFResponse>} asyncFunction the async function to wrap
 * @return {*}  {AsyncFunction<AFArgs, AFResponse>}
 */
export const useAsync = <AFArgs extends any[], AFResponse>(
  asyncFunction: AsyncFunction<AFArgs, AFResponse>
): AsyncFunction<AFArgs, AFResponse> => {
  // Initialize refs with `null` for better type inference.
  const ref = useRef<Promise<AFResponse> | null>(null);
  const isPending = useRef(false);

  const wrappedAsyncFunction: AsyncFunction<AFArgs, AFResponse> = useCallback(
    async (...args) => {
      // If there's already a pending promise, return the existing one.
      if (ref.current && isPending.current) {
        return ref.current;
      }

      isPending.current = true;

      ref.current = asyncFunction(...args).then(
        (response: AFResponse) => {
          isPending.current = false;
          return response;
        },
        (error) => {
          isPending.current = false;
          throw error;
        }
      );

      return ref.current;
    },
    [asyncFunction]
  );

  return wrappedAsyncFunction;
};
