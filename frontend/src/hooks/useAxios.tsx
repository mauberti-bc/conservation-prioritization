import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { useMemo } from 'react';

/**
 * Custom API error class to wrap Axios errors with additional context.
 */
export class APIError extends Error {
  status: number;
  errors?: (string | object)[];
  requestURL?: string;

  constructor(error: AxiosError<any, any>) {
    super(error.response?.data?.message || error.message);

    this.name = error.response?.data?.name || error.name;
    this.status = error.response?.data?.status || error.response?.status || 500;
    this.errors = error.response?.data?.errors || [];
    this.requestURL = `${error?.config?.baseURL}${error?.config?.url}`;
  }
}

/**
 * Ensures a URL has a protocol (http:// or https://).
 */
const ensureProtocol = (url: string): string => {
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
};

/**
 * Returns an Axios instance with baseURL set.
 *
 * @param {string} [baseUrl] - Optional base URL
 * @returns {AxiosInstance}
 */
const useAxios = (baseUrl?: string): AxiosInstance => {
  return useMemo(() => {
    const instance = axios.create({
      baseURL: baseUrl && ensureProtocol(baseUrl),
    });

    instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        throw new APIError(error);
      }
    );

    return instance;
  }, [baseUrl]);
};

export default useAxios;
