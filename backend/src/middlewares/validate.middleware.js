import { validationError } from '../utils/errors.js';

/**
 * Runs a zod schema against one part of the request and replaces that part with the
 * parsed (sanitised, coerced, defaulted) result — handlers therefore only ever see
 * validated data. Policy §2: never trust the frontend.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body' | 'query' | 'params'} source
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(validationError(errors));
    }
    // req.query is a getter on Express 5; assign to a separate key when needed.
    if (source === 'query') {
      req.validatedQuery = result.data;
    } else {
      req[source] = result.data;
    }
    return next();
  };
}
