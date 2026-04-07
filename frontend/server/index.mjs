import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
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
  const apiHost = process.env.API_HOST;

  const objectStoreUrl = process.env.OBJECT_STORE_URL || '';
  const objectStoreBucketName = process.env.OBJECT_STORE_BUCKET_NAME || '';
  const s3PublicHostUrl = objectStoreUrl && objectStoreBucketName
    ? ensureProtocol(`${objectStoreUrl}/${objectStoreBucketName}`, 'https://')
    : '';

  return {
    API_HOST: ensureProtocol(apiHost, 'https://'),
    CHANGE_VERSION: process.env.CHANGE_VERSION,
    NODE_ENV: process.env.NODE_ENV,
    VITE_APP_NODE_ENV: process.env.APP_NODE_ENV,
    VERSION: `${process.env.VERSION}(build #${process.env.CHANGE_VERSION})`,
    KEYCLOAK_CONFIG: {
      authority: process.env.KEYCLOAK_HOST,
      realm: process.env.KEYCLOAK_REALM,
      clientId: process.env.KEYCLOAK_CLIENT_ID,
    },
    SITEMINDER_LOGOUT_URL: process.env.SITEMINDER_LOGOUT_URL,
    MAX_UPLOAD_NUM_FILES: Number(process.env.MAX_UPLOAD_NUM_FILES),
    MAX_UPLOAD_FILE_SIZE: Number(process.env.MAX_UPLOAD_FILE_SIZE),
    S3_PUBLIC_HOST_URL: s3PublicHostUrl,
    FEATURE_FLAGS: (process.env.FEATURE_FLAGS || '')
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
