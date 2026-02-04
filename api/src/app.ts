import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import { initialize } from 'express-openapi';
import multer from 'multer';
import { OpenAPIV3 } from 'openapi-types';
import swaggerUIExpress from 'swagger-ui-express';
import { defaultPoolConfig, initDBPool } from './database/db';
import { initDBConstants } from './database/db-constants';
import { ensureHTTPError, HTTP400, HTTP500 } from './errors/http-error';
import { rootAPIDoc } from './openapi/root-api-doc';
import { authenticateRequest, authenticateRequestOptional } from './request-handlers/security/authentication';
import { initRequestStorage } from './utils/async-request-storage';
import { scanFileForVirus } from './utils/file-utils';
import { getLogger } from './utils/logger';
import { handleWebSocketUpgrade } from './websocket/ws-server';

const logger = getLogger('app');

const HOST = process.env.API_HOST;
const PORT = Number(process.env.API_PORT);

const MAX_REQ_BODY_SIZE = Number(process.env.MAX_REQ_BODY_SIZE) || 50 * 1024 * 1024;
const MAX_UPLOAD_NUM_FILES = Number(process.env.MAX_UPLOAD_NUM_FILES) || 10;
const MAX_UPLOAD_FILE_SIZE = Number(process.env.MAX_UPLOAD_FILE_SIZE) || 50 * 1024 * 1024;

const app = express();
const server = http.createServer(app);

// --- Middleware ---
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization, responseType');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE, HEAD');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  logger.debug({ label: 'api-middleware', method: req.method, url: req.url });
  next();
});

// --- OpenAPI ---
const openAPIFramework = initialize({
  apiDoc: {
    ...(rootAPIDoc as OpenAPIV3.Document),
    'x-express-openapi-additional-middleware': getAdditionalMiddleware(),
    'x-express-openapi-validation-strict': true
  },
  app,
  paths: './src/paths',
  pathsIgnore: new RegExp('.(spec|test)$'),
  routesGlob: '**/*.{ts,js}',
  routesIndexFileRegExp: /(?:index)?\.[tj]s$/,
  promiseMode: true,
  docsPath: '/raw-api-docs',
  consumesMiddleware: {
    'application/json': express.json({ limit: MAX_REQ_BODY_SIZE }),
    'application/x-www-form-urlencoded': express.urlencoded({ limit: MAX_REQ_BODY_SIZE, extended: true }),
    'multipart/form-data': (req, res, next) => handleMultipart(req, res, next)
  },
  securityHandlers: {
    Bearer: async (req) => {
      return authenticateRequest(req as Request);
    },
    OptionalBearer: async (req) => {
      return authenticateRequestOptional(req as Request);
    }
  },
  errorTransformer: (_, ajvError) => ajvError,
  errorMiddleware: (error, req, res, next) => handleErrorMiddleware(error, req, res, next)
});

// Serve OpenAPI UI
app.use(
  '/api-docs',
  swaggerUIExpress.serve as unknown as express.RequestHandler,
  swaggerUIExpress.setup(openAPIFramework.apiDoc) as unknown as express.RequestHandler
);

// --- App Startup ---
(async () => {
  try {
    initDBPool(defaultPoolConfig);
    await initDBConstants();

    server.on('upgrade', (req, socket, head) => {
      handleWebSocketUpgrade(req, socket, head);
    });

    server.listen(PORT, () => {
      logger.info({ label: 'start api', message: `API running on ${HOST}:${PORT}/api` });
    });
  } catch (error) {
    logger.error({ label: 'start api', message: 'Failed to start API', error });
    process.exit(1);
  }
})();

// --- Functions ---
function getAdditionalMiddleware(): express.RequestHandler[] {
  const middleware: express.RequestHandler[] = [initRequestStorage];

  if (process.env.API_RESPONSE_VALIDATION_ENABLED === 'true') {
    middleware.push(validateAllResponses);
  }

  return middleware;
}

async function handleMultipart(req: Request, res: Response, next: NextFunction) {
  const multerHandler = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_FILE_SIZE }
  }).array('media', MAX_UPLOAD_NUM_FILES);

  // Wrap in promise to allow async/await
  multerHandler(req as any, res as any, (err?: any) => {
    if (err) {
      return next(err);
    }

    const files = (req.files as Express.Multer.File[]) || [];

    Promise.all(
      files.map(async (file) => {
        const isSafe = await scanFileForVirus(file);
        if (!isSafe) {
          throw new HTTP400('Malicious file content detected.', [{ file_name: file.originalname }]);
        }
      })
    )
      .then(() => {
        req.files = files;
        req.body = { ...req.body, media: files };
        next();
      })
      .catch(next);
  });
}

function handleErrorMiddleware(error: any, req: Request, res: Response, next: NextFunction) {
  logger.error({
    label: 'errorMiddleware',
    error,
    req_url: `${req.method} ${req.url}`,
    req_params: req.params,
    req_body: req.body
  });

  const httpError = ensureHTTPError(error);

  if (!res.headersSent) {
    res.status(httpError.status).json({
      name: httpError.name,
      status: httpError.status,
      message: httpError.message,
      errors: httpError.errors
    });
  }
}

const isStrictValidationEnabled = process.env.API_RESPONSE_VALIDATION_ENABLED === 'true';

function validateAllResponses(req: Request, res: Response, next: NextFunction) {
  if (typeof res.validateResponse === 'function') {
    const originalJson = res.json.bind(res);

    res.json = (body?: any): Response => {
      if (res.get('x-express-openapi-validation-error-for')) {
        return originalJson(body);
      }

      const validationResult = res.validateResponse?.(res.statusCode, body);

      if (isStrictValidationEnabled && validationResult?.errors?.length) {
        throw new HTTP500(`Invalid response for status code ${res.statusCode}`, validationResult.errors);
      }

      return originalJson(body);
    };
  }

  next();
}
