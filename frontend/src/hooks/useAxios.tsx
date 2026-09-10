import axios, { AxiosError, AxiosHeaders, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
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
 *
 * @param {string} url The API URL, with or without a protocol.
 * @returns {string} The URL with its existing protocol or an added HTTPS protocol.
 */
const ensureProtocol = (url: string): string => {
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
};

/**
 * Returns an Axios instance that attaches the access token and retries a 401 once after token renewal.
 *
 * Failed requests are surfaced as APIError instances after recovery is exhausted or renewal fails.
 *
 * @param {string} [baseUrl] The API base URL; HTTPS is added when no protocol is specified.
 * @returns {AxiosInstance} The configured API client with authentication and error handling interceptors.
 */
const useAxios = (baseUrl?: string): AxiosInstance => {
  const authContext = useContext(AuthContext);
  const accessToken = authContext?.auth?.user?.access_token;
  const getValidAccessToken = authContext?.getValidAccessToken;
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
      async (error: AxiosError) => {
        const statusCode = error.response?.status;
        const requestConfig = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

        if (statusCode === 401 && requestConfig && !requestConfig._retry && getValidAccessToken) {
          requestConfig._retry = true;
          const refreshedToken = await getValidAccessToken(true);

          if (refreshedToken) {
            tokenRef.current = refreshedToken;
            const headers =
              requestConfig.headers instanceof AxiosHeaders
                ? requestConfig.headers
                : AxiosHeaders.from(requestConfig.headers);
            headers.set('Authorization', `Bearer ${refreshedToken}`);
            requestConfig.headers = headers;
            return await instance(requestConfig);
          }
        }

        throw new APIError(error);
      }
    );

    return instance;
  }, [accessToken, baseUrl, getValidAccessToken]);
};

export default useAxios;
