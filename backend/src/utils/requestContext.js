/**
 * The request metadata that services attach to audit entries (policy §5).
 * Extracted here so controllers stay one line thick.
 */
export function contextOf(req) {
  return {
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.id || null,
  };
}

/**
 * Wraps an async handler so a rejected promise reaches the error middleware
 * instead of hanging the request.
 */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
