import { ensureProtocol } from 'utils/util';

/**
 * Builds a websocket URL from a base API host and path.
 *
 * @param {string} baseUrl Base URL used to construct the resource address.
 * @param {string} path Resource path to resolve.
 * @returns {string} Web socket url.
 */
export const buildWebSocketUrl = (baseUrl: string, path: string): string => {
  const normalizedBase = ensureProtocol(baseUrl, 'http://');
  const url = new URL(path, normalizedBase);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

  return `${protocol}//${url.host}${url.pathname}${url.search}`;
};
