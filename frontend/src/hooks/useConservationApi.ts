import { usePrefectApi } from './api/usePrefectApi';

/**
 * Returns a set of supported api methods.
 *
 * @return {*} object whose properties are supported api methods.
 */
export const useConservationApi = () => {
  const prefect = usePrefectApi();

  return { prefect };
};
