import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { sendError } from '../utils/response.js';

/**
 * Rate limiting (policy §9). Credential endpoints get the strict 5/min budget;
 * everything else gets a wider global bucket.
 */

function handler(req, res) {
  return sendError(res, {
    status: 429,
    message: 'Too many requests. Please try again in a moment.',
  });
}

const shared = {
  windowMs: config.security.rateLimitWindowMs,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
  // Disabled under test so the suite is not throttled by earlier cases.
  skip: () => config.isTest,
};

export const globalLimiter = rateLimit({
  ...shared,
  limit: config.security.rateLimitGlobalMax,
});

export const authLimiter = rateLimit({
  ...shared,
  limit: config.security.rateLimitAuthMax,
  // Counts failures per IP; a successful login does not consume the budget.
  skipSuccessfulRequests: true,
});
