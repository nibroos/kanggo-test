import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';

import { config } from './config/env.js';
import apiRoutes from './routes/index.js';
import healthRoutes from './routes/health.routes.js';
import { requestId, httpLogger } from './middlewares/requestContext.middleware.js';
import { globalLimiter } from './middlewares/rateLimit.middleware.js';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware.js';
import { logger } from './utils/logger.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp() {
  const app = express();

  // Behind a reverse proxy (policy §9), so req.ip and the rate limiter see the
  // real client address rather than the proxy's.
  app.set('trust proxy', config.isProduction ? 1 : false);
  app.disable('x-powered-by');

  // Security headers (policy §9). CSP is left to the frontend host: this process
  // serves JSON plus the Swagger UI, and a strict CSP breaks the latter.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
      hsts: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  // Explicit origin allowlist — never `*` (policy §9).
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and non-browser clients (curl, tests) send no Origin header.
        if (!origin || config.security.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Reply without the Allow-Origin header rather than throwing: the browser
        // blocks the response, and a stray Origin header from a non-browser client
        // does not turn into a 500.
        logger.debug({ origin }, 'Blocked cross-origin request from an untrusted origin');
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.use(requestId);
  if (!config.isTest) app.use(httpLogger);

  app.use(globalLimiter);

  // Probes are mounted before the API prefix so orchestrators can reach them
  // without an auth token.
  app.use('/', healthRoutes);

  // OpenAPI (spec §18.3). Missing spec file is not fatal — the API still runs.
  const openApiPath = path.join(rootDir, 'docs', 'openapi.yaml');
  if (fs.existsSync(openApiPath)) {
    try {
      const document = YAML.parse(fs.readFileSync(openApiPath, 'utf8'));
      app.get('/api/docs.json', (req, res) => res.json(document));
      app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: 'Task Management API' }));
    } catch (error) {
      logger.warn({ err: error }, 'Could not load OpenAPI document');
    }
  }

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
