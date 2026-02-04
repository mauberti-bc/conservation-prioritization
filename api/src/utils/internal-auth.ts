import { HTTP401, HTTP403, HTTP500 } from '../errors/http-error';

/**
 * Enforces internal API authorization using a shared API key.
 *
 * @param {Record<string, string | string[] | undefined>} headers
 * @return {*} {void}
 */
export const enforceInternalAuth = (headers: Record<string, string | string[] | undefined>): void => {
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    throw new HTTP500('INTERNAL_API_KEY is not configured for internal endpoints.');
  }

  const providedKey = headers['x-internal-api-key'];

  if (!providedKey) {
    throw new HTTP401('Missing internal API key.');
  }

  const normalizedKey = Array.isArray(providedKey) ? providedKey[0] : providedKey;

  if (normalizedKey !== expectedKey) {
    throw new HTTP403('Invalid internal API key.');
  }
};
