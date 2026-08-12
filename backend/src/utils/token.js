import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { unauthorized } from './errors.js';

/**
 * Short-lived access token (policy §3: 15-30 minutes).
 */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, name: user.name, type: 'access' },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl, issuer: config.jwt.issuer },
  );
}

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret, { issuer: config.jwt.issuer });
    if (payload.type !== 'access') throw new Error('wrong token type');
    return payload;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw unauthorized('Access token expired');
    }
    throw unauthorized('Invalid access token');
  }
}

/**
 * Long-lived refresh token (policy §3: 7-30 days).
 *
 * The JWT itself is handed to the client, but only its SHA-256 digest is stored,
 * so a database leak cannot be replayed as a valid session. Rotation and
 * revocation are handled in the auth service.
 */
export function signRefreshToken(user, jti) {
  return jwt.sign(
    { sub: String(user.id), jti, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: `${config.jwt.refreshTtlDays}d`, issuer: config.jwt.issuer },
  );
}

export function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.refreshSecret, { issuer: config.jwt.issuer });
    if (payload.type !== 'refresh') throw new Error('wrong token type');
    return payload;
  } catch {
    throw unauthorized('Invalid or expired refresh token');
  }
}

export function newTokenId() {
  return crypto.randomUUID();
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry() {
  const expires = new Date();
  expires.setDate(expires.getDate() + config.jwt.refreshTtlDays);
  return expires;
}

/**
 * Access token lifetime in seconds, so the client can schedule a refresh.
 */
export function accessTokenTtlSeconds() {
  const value = config.jwt.accessTtl;
  const match = /^(\d+)([smhd])$/.exec(String(value));
  if (!match) return Number.parseInt(value, 10) || 900;
  const amount = Number.parseInt(match[1], 10);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
  return amount * unit;
}
