import { Router } from 'express';
import { pingDatabase } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

/**
 * Liveness / readiness probes (policy §12).
 *
 *   /live   the process is up — never touches a dependency
 *   /ready  the process can serve traffic — verifies the database
 *   /health human-facing summary
 */
const router = Router();

const startedAt = Date.now();

router.get('/live', (req, res) =>
  sendSuccess(res, { message: 'alive', data: { status: 'ok', uptime_seconds: Math.floor((Date.now() - startedAt) / 1000) } }),
);

router.get('/ready', async (req, res) => {
  try {
    await pingDatabase();
    return sendSuccess(res, { message: 'ready', data: { status: 'ok', database: 'up' } });
  } catch (error) {
    logger.error({ err: error }, 'Readiness probe failed');
    return sendError(res, { status: 503, message: 'Service Unavailable' });
  }
});

router.get('/health', async (req, res) => {
  let database = 'up';
  try {
    await pingDatabase();
  } catch {
    database = 'down';
  }
  const healthy = database === 'up';
  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? 'healthy' : 'degraded',
    data: {
      status: healthy ? 'ok' : 'degraded',
      database,
      uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    },
    meta: {},
  });
});

export default router;
