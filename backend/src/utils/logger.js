import pino from 'pino';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');

/**
 * Structured logger (policy §5). Secrets and credentials are redacted so they can
 * never reach the log sink, even if a handler logs a whole request object.
 */
export const logger = pino({
  level,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.refreshToken',
      'password',
      'password_hash',
      'refreshToken',
      'accessToken',
      'token_hash',
    ],
    censor: '[REDACTED]',
  },
  base: { service: 'task-management-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
