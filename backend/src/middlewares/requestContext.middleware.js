import crypto from 'node:crypto';
import pinoHttp from 'pino-http';
import { logger } from '../utils/logger.js';

/**
 * Assigns a request id and logs one structured line per request with the fields
 * policy §5 asks for: request id, user id, IP, user agent, method, endpoint,
 * status code and response time.
 *
 * Trace/span ids are the one item from that list not emitted here — see the
 * "Policy deviations" section of the README.
 */
export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && incoming.length <= 64 ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  quietReqLogger: true,
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customProps(req) {
    return {
      requestId: req.id,
      userId: req.user?.id ?? null,
      ip: req.ip,
      userAgent: req.get('user-agent') || null,
    };
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
