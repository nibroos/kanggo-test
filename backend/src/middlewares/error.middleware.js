import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  return sendError(res, { status: 404, message: `Route ${req.method} ${req.originalUrl} not found` });
}

/**
 * Single error boundary (policy §10). Expected failures keep their message and
 * field errors; anything else is logged in full server-side and reduced to a bare
 * "Internal Server Error" for the client — no SQL text, no stack trace.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(error, req, res, next) {
  if (error instanceof AppError) {
    if (error.status >= 500) {
      logger.error({ err: error, requestId: req.id }, 'Application error');
    }
    return sendError(res, {
      status: error.status,
      message: error.message,
      errors: error.errors,
    });
  }

  // Body-parser rejects malformed JSON before any route runs.
  if (error?.type === 'entity.parse.failed') {
    return sendError(res, { status: 400, message: 'Request body is not valid JSON' });
  }
  if (error?.type === 'entity.too.large') {
    return sendError(res, { status: 413, message: 'Request body is too large' });
  }

  logger.error(
    { err: error, requestId: req.id, userId: req.user?.id ?? null },
    'Unhandled error',
  );
  return sendError(res, { status: 500, message: 'Internal Server Error' });
}
