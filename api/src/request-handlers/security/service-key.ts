import { RequestHandler } from 'express-serve-static-core';
import { HTTP401, HTTP403, HTTP500 } from '../../errors/http-error';

const SERVICE_KEY_HEADER = 'x-internal-api-key';

/**
 * Requires a service key header to authorize non-user requests.
 *
 * @returns {RequestHandler}
 */
export const requireServiceKey = (): RequestHandler => {
  return (req, _res, next) => {
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (!expectedKey) {
      throw new HTTP500('INTERNAL_API_KEY is not configured for service-key endpoints.');
    }

    const providedKey = req.headers[SERVICE_KEY_HEADER];

    if (!providedKey) {
      throw new HTTP401('Missing service key.');
    }

    const normalizedKey = Array.isArray(providedKey) ? providedKey[0] : providedKey;

    if (normalizedKey !== expectedKey) {
      throw new HTTP403('Invalid service key.');
    }

    next();
  };
};
