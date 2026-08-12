import bcrypt from 'bcrypt';
import { config } from '../config/env.js';

/**
 * Password hashing (spec §3.1 requires bcrypt; policy §3 allows bcrypt).
 * Plaintext passwords are never stored and never logged.
 */
export function hashPassword(plain) {
  return bcrypt.hash(plain, config.security.bcryptRounds);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
