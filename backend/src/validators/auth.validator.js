import { z } from 'zod';
import { cleanSingleLine, cleanEmail } from '../utils/sanitize.js';

/**
 * Auth request schemas (spec §12, policy §2). Sanitisation runs before validation
 * so " Ada@Example.COM " and "ada@example.com" are the same account.
 */

const email = z
  .preprocess(cleanEmail, z.string({ required_error: 'Email is required' })
    .min(1, 'Email is required')
    .max(191, 'Email must be at most 191 characters')
    .email('Email format is invalid'));

const password = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters'); // bcrypt truncates beyond 72 bytes

export const registerSchema = z.object({
  name: z.preprocess(
    cleanSingleLine,
    z
      .string({ required_error: 'Name is required' })
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be at most 100 characters'),
  ),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token is required' })
    .min(1, 'Refresh token is required'),
});
