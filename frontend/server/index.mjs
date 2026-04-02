import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticRoot = path.resolve(__dirname, '../build');

const port = Number(process.env.APP_PORT || process.env.PORT || 7070);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

/**
 * Writes a JSON response.
 *
 * @param {import('node:http').ServerResponse} response
 * @param {number} statusCode
 * @param {unknown} payload
 */
const writeJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
};

/**
 * Parses an integer-like environment variable with fallback.
 *
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
const toNumber = (value, fallback) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
};

/**
 * Ensures URL includes a protocol.
 *
 * @param {string} value
 * @param {string} fallbackProtocol
 * @returns {string}
 */
const ensureProtocol = (value, fallbackProtocol) => {
  if (!value) {
    return value;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `${fallbackProtocol}${value}`;
};

/**
 * Gets runtime frontend configuration.
 *
 * @returns {Record<string, unknown>}
 */
const getConfig = () => {
  const apiHostFromValues = process.env.API_HOST || process.env.VITE_APP_API_HOST || '';
  const apiPortFromValues = process.env.API_PORT || process.env.VITE_APP_API_PORT || '';
  const conservationApiUrl = process.env.CONSERVATION_API_URL || '';

  let apiHost = '';
  if (conservationApiUrl) {
    apiHost = conservationApiUrl;
  } else if (apiHostFromValues && apiPortFromValues) {
    apiHost = `${apiHostFromValues}:${apiPortFromValues}`;
  } else {
    apiHost = apiHostFromValues || 'localhost';
  }

  const objectStoreUrl = process.env.OBJECT_STORE_URL || '';
  const objectStoreBucketName = process.env.OBJECT_STORE_BUCKET_NAME || '';
  const s3PublicHostUrl = objectStoreUrl && objectStoreBucketName
    ? ensureProtocol(`${objectStoreUrl}/${objectStoreBucketName}`, 'https://')
    : '';

  return {
    API_HOST: ensureProtocol(apiHost, 'http://'),
    CHANGE_VERSION: process.env.CHANGE_VERSION || 'NA',
    NODE_ENV: process.env.NODE_ENV || 'production',
    VITE_APP_NODE_ENV: process.env.VITE_APP_NODE_ENV || process.env.VITE_NODE_ENV || process.env.NODE_ENV || 'production',
    VERSION: `${process.env.VERSION || 'NA'}(build #${process.env.CHANGE_VERSION || 'NA'})`,
    KEYCLOAK_CONFIG: {
      authority: process.env.VITE_APP_KEYCLOAK_HOST || process.env.KEYCLOAK_HOST || '',
      realm: process.env.VITE_APP_KEYCLOAK_REALM || process.env.KEYCLOAK_REALM || '',
      clientId: process.env.VITE_APP_KEYCLOAK_CLIENT_ID || process.env.KEYCLOAK_API_CLIENT_ID || '',
    },
    SITEMINDER_LOGOUT_URL: process.env.VITE_APP_SITEMINDER_LOGOUT_URL || '',
    MAX_UPLOAD_NUM_FILES: toNumber(process.env.VITE_APP_MAX_UPLOAD_NUM_FILES, 10),
    MAX_UPLOAD_FILE_SIZE: toNumber(process.env.VITE_APP_MAX_UPLOAD_FILE_SIZE, 52428800),
    S3_PUBLIC_HOST_URL: s3PublicHostUrl,
    BACKBONE_PUBLIC_API_HOST: process.env.VITE_APP_BACKBONE_PUBLIC_API_HOST || '',
    BIOHUB_TAXON_PATH: process.env.VITE_APP_BIOHUB_TAXON_PATH || '',
    BIOHUB_TAXON_TSN_PATH: process.env.VITE_APP_BIOHUB_TAXON_TSN_PATH || '',
    FEATURE_FLAGS: (process.env.VITE_APP_FEATURE_FLAGS || '')
      .split(',')
      .map((featureFlag) => featureFlag.trim())
      .filter(Boolean),
  };
};

/**
 * Resolves a request path to a file under static root.
 *
 * @param {string} requestPath
 * @returns {string}
 */
const resolveStaticPath = (requestPath) => {
  const normalizedPath = decodeURIComponent(requestPath.split('?')[0]).replace(/^\/+/, '');
  const requestedPath = path.resolve(staticRoot, normalizedPath);

  if (!requestedPath.startsWith(staticRoot)) {
    return path.join(staticRoot, 'index.html');
  }

  return requestedPath;
};

/**
 * Writes a static file response.
 *
 * @param {import('node:http').ServerResponse} response
 * @param {string} filePath
 */
const writeStaticFile = async (response, filePath) => {
  const fileStats = await stat(filePath);
  if (fileStats.isDirectory()) {
    throw new Error('Directory path is not directly readable');
  }

  const extension = path.extname(filePath);
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';
  const content = await readFile(filePath);

  response.writeHead(200, { 'Content-Type': contentType });
  response.end(content);
};

createServer(async (request, response) => {
  const method = request.method || 'GET';
  const url = request.url || '/';

  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405);
    response.end();
    return;
  }

  if (url === '/health' || url === '/healthcheck') {
    writeJson(response, 200, { success: true });
    return;
  }

  if (url === '/config') {
    writeJson(response, 200, getConfig());
    return;
  }

  try {
    const staticPath = resolveStaticPath(url);
    await writeStaticFile(response, staticPath);
    return;
  } catch (_error) {
    try {
      await writeStaticFile(response, path.join(staticRoot, 'index.html'));
      return;
    } catch (_indexError) {
      writeJson(response, 500, { error: 'Unable to serve frontend assets' });
      return;
    }
  }
}).listen(port, () => {
  console.log(`Frontend runtime server listening on port ${port}`);
});
