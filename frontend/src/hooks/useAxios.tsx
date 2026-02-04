import axios, { AxiosError, AxiosHeaders, AxiosInstance, AxiosResponse } from 'axios';
import { AuthContext } from 'context/authContext';
import { useContext, useEffect, useMemo, useRef } from 'react';

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
  const authContext = useContext(AuthContext);
  const accessToken = authContext?.auth?.user?.access_token;
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = accessToken ?? null;
  }, [accessToken]);

  return useMemo(() => {
    const instance = axios.create({
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken}` : undefined,
      },
      baseURL: baseUrl && ensureProtocol(baseUrl),
    });

    instance.interceptors.request.use((config) => {
      if (tokenRef.current) {
        const headers = config.headers instanceof AxiosHeaders ? config.headers : AxiosHeaders.from(config.headers);
        headers.set('Authorization', `Bearer ${tokenRef.current}`);
        config.headers = headers;
      }

      return config;
    });

    instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.status !== 401) {
          throw new APIError(error);
        }
      }
    );

    return instance;
  }, [accessToken, baseUrl]);
};

export default useAxios;
