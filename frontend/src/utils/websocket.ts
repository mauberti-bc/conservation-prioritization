import { ensureProtocol } from 'utils/util';

/**
 * Builds a websocket URL from a base API host and path.
 *
 * @param {string} baseUrl
 * @param {string} path
 * @return {*}  {string}
 */
export const buildWebSocketUrl = (baseUrl: string, path: string): string => {
  const normalizedBase = ensureProtocol(baseUrl, 'http://');
  const url = new URL(path, normalizedBase);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

  return `${protocol}//${url.host}${url.pathname}${url.search}`;
};
