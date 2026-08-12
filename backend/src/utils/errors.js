/**
 * Application-level error carrying an HTTP status. Anything thrown that is *not*
 * an AppError is treated as an unexpected failure and reported to the client as a
 * generic 500 (policy §10: never expose SQL errors, stack traces or internals).
 */
export class AppError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} message client-safe message
   * @param {Array<{field: string, message: string}>} [errors] field level errors
   */
  constructor(status, message, errors = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.errors = errors;
    this.expected = true;
  }
}

export const badRequest = (message = 'Bad Request', errors = []) => new AppError(400, message, errors);
export const unauthorized = (message = 'Unauthorized') => new AppError(401, message);
export const forbidden = (message = 'Forbidden') => new AppError(403, message);
export const notFound = (message = 'Not Found') => new AppError(404, message);
export const conflict = (message = 'Conflict') => new AppError(409, message);
export const validationError = (errors, message = 'Validation Error') => new AppError(422, message, errors);
export const tooManyRequests = (message = 'Too Many Requests') => new AppError(429, message);
