import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
import { registerSchema, loginSchema, refreshSchema } from '../validators/auth.validator.js';

const router = Router();

// Public (spec §8: registration and login need no existing JWT), rate limited to
// 5 failed attempts per minute per IP (policy §9).
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, validate(refreshSchema), authController.refresh);

// Authenticated.
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
