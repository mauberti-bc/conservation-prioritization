import { AuthContext } from 'context/authContext';
import { useCallback, useContext, useMemo } from 'react';
import { APIError } from './useAxios';

export interface WebsocketRequestOptions {
  protocols?: string | string[];
  query?: Record<string, string>;
  baseUrl?: string;
}

export interface WebsocketClient {
  /**
   * Open a websocket connection and resolve when it is ready.
   *
   * @param {string} path
   * @param {WebsocketRequestOptions} options
   * @returns {Promise<WebSocket>} A websocket connection once it is open.
   */
  get: (path: string, options?: WebsocketRequestOptions) => Promise<WebSocket>;
  /**
   * Subscribe to a websocket endpoint with automatic reconnect.
   *
   * @param {string} path
   * @param {WebsocketRequestOptions | undefined} options
   * @param {WebsocketSubscriptionHandlers} handlers
   * @returns {{ stop: () => void }} Subscription controls.
   */
  subscribe: (
    path: string,
    options: WebsocketRequestOptions | undefined,
    handlers: WebsocketSubscriptionHandlers
  ) => { stop: () => void };
}

export interface WebsocketSubscriptionHandlers {
  onMessage: (event: MessageEvent) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

/**
 * Join URL path segments, preserving a base prefix when provided.
 *
 * @param {string} basePath
 * @param {string} nextPath
 * @returns {string} A normalized path string.
 */
const joinPaths = (basePath: string, nextPath: string): string => {
  const trimmedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const trimmedNext = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;

  if (!trimmedBase) {
    return trimmedNext;
  }

  return `${trimmedBase}${trimmedNext}`;
};

/**
 * Normalize websocket subprotocols into an array.
 *
 * @param {string | string[] | undefined} protocols
 * @returns {string[]} Normalized protocol list.
 */
const normalizeProtocols = (protocols?: string | string[]): string[] => {
  if (!protocols) {
    return [];
  }

  if (Array.isArray(protocols)) {
    return protocols;
  }

  return [protocols];
};

/**
 * Returns a websocket client that mirrors the axios hook behavior for URL building.
 *
 * @param {string} baseUrl
 * @returns {WebsocketClient} A websocket client with auth-aware URL handling.
 */
export const useWebsocket = (baseUrl?: string): WebsocketClient => {
  const authContext = useContext(AuthContext);

  /**
   * Build a websocket URL with auth and query parameters applied.
   *
   * @param {string} path
   * @param {WebsocketRequestOptions} options
   * @returns {string} A fully-qualified websocket URL.
   */
  const buildUrl = useCallback(
    (path: string, options?: WebsocketRequestOptions): string => {
      const resolvedBaseUrl = options?.baseUrl ?? baseUrl ?? window.location.origin;
      const parsedUrl = new URL(resolvedBaseUrl, window.location.origin);

      let protocol = 'ws:';
      if (parsedUrl.protocol === 'https:') {
        protocol = 'wss:';
      }
      parsedUrl.protocol = protocol;

      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      parsedUrl.pathname = joinPaths(parsedUrl.pathname, normalizedPath);
      parsedUrl.search = '';

      if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
          parsedUrl.searchParams.set(key, value);
        });
      }

      return parsedUrl.toString();
    },
    [baseUrl]
  );

  /**
   * Open a websocket connection and resolve once the connection is established.
   *
   * @param {string} path
   * @param {WebsocketRequestOptions} options
   * @returns {Promise<WebSocket>} A websocket connection once open.
   */
  const get = useCallback(
    async (path: string, options?: WebsocketRequestOptions): Promise<WebSocket> => {
      const url = buildUrl(path, options);

      return new Promise((resolve, reject) => {
        let socket: WebSocket | null = null;
        let settled = false;
        const timeoutMs = 10000;
        let timeoutId: number | null = null;

        let handleOpen: (() => void) | null = null;
        let handleError: (() => void) | null = null;
        let handleClose: ((event: CloseEvent) => void) | null = null;

        const cleanup = (): void => {
          if (timeoutId) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
          }

          if (!socket) {
            return;
          }
          if (handleOpen) {
            socket.removeEventListener('open', handleOpen);
          }
          if (handleError) {
            socket.removeEventListener('error', handleError);
          }
          if (handleClose) {
            socket.removeEventListener('close', handleClose);
          }
        };

        const rejectOnce = (error: Error): void => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          reject(error);
        };

        const resolveOnce = (resolvedSocket: WebSocket): void => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(resolvedSocket);
        };

        const accessToken = authContext?.auth?.user?.access_token;
        const baseProtocols = normalizeProtocols(options?.protocols);
        const protocols = accessToken ? [`bearer.${accessToken}`, ...baseProtocols] : baseProtocols;

        try {
          socket = new WebSocket(url, protocols.length > 0 ? protocols : undefined);
        } catch (error) {
          rejectOnce(error instanceof Error ? error : new Error('Failed to create websocket'));
          return;
        }

        timeoutId = window.setTimeout(() => {
          if (socket && socket.readyState !== WebSocket.OPEN) {
            socket.close(1000, 'Websocket connection timeout');
            rejectOnce(new Error('Websocket connection timed out'));
          }
        }, timeoutMs);

        handleOpen = (): void => {
          if (!socket) {
            rejectOnce(new Error('Websocket opened without a socket reference'));
            return;
          }
          resolveOnce(socket);
        };

        handleError = (): void => {
          if (!socket || socket.readyState === WebSocket.OPEN) {
            return;
          }
          rejectOnce(new Error('Websocket connection error'));
        };

        handleClose = (event: CloseEvent): void => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            return;
          }
          rejectOnce(new Error(`Websocket closed before open (code ${event.code})`));
        };

        if (handleOpen) {
          socket.addEventListener('open', handleOpen);
        }
        if (handleError) {
          socket.addEventListener('error', handleError);
        }
        if (handleClose) {
          socket.addEventListener('close', handleClose);
        }
      });
    },
    [authContext?.auth?.user?.access_token, buildUrl]
  );

  /**
   * Subscribe to a websocket endpoint with automatic reconnect.
   *
   * @param {string} path
   * @param {WebsocketRequestOptions | undefined} options
   * @param {WebsocketSubscriptionHandlers} handlers
   * @returns {{ stop: () => void }} Subscription controls.
   */
  const subscribe = useCallback(
    (path: string, options: WebsocketRequestOptions | undefined, handlers: WebsocketSubscriptionHandlers) => {
      let stopped = false;
      let socket: WebSocket | null = null;
      let reconnectTimer: number | null = null;
      let backoffMs = 250;
      const maxBackoffMs = 10000;

      const clearReconnectTimer = (): void => {
        if (reconnectTimer) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      const scheduleReconnect = (): void => {
        if (stopped || reconnectTimer) {
          return;
        }

        const jitter = Math.floor(Math.random() * 250);
        const delay = Math.min(backoffMs, maxBackoffMs) + jitter;
        backoffMs = Math.min(backoffMs * 2, maxBackoffMs);

        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          void connect();
        }, delay);
      };

      const attachSocketHandlers = (connectedSocket: WebSocket): void => {
        connectedSocket.onmessage = (event) => {
          handlers.onMessage(event);
        };

        connectedSocket.onclose = (event) => {
          console.info('Websocket closed', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
          handlers.onClose?.(event);
          if (!stopped) {
            scheduleReconnect();
          }
        };

        connectedSocket.onerror = (event) => {
          handlers.onError?.(event);
          if (!stopped && connectedSocket.readyState !== WebSocket.OPEN) {
            scheduleReconnect();
          }
        };
      };

      const connect = async (): Promise<void> => {
        if (stopped) {
          return;
        }

        try {
          const nextSocket = await get(path, options);
          if (stopped) {
            nextSocket.close();
            return;
          }

          socket = nextSocket;
          backoffMs = 250;
          handlers.onOpen?.();
          attachSocketHandlers(nextSocket);
        } catch (error) {
          handlers.onError?.(new Event((error as APIError).message));
          scheduleReconnect();
        }
      };

      void connect();

      return {
        stop: (): void => {
          stopped = true;
          clearReconnectTimer();
          if (socket) {
            socket.close();
            socket = null;
          }
        },
      };
    },
    [get]
  );

  return useMemo(
    () => ({
      get,
      subscribe,
    }),
    [get, subscribe]
  );
};

export default useWebsocket;
