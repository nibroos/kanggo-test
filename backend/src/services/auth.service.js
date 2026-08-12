import { randomUUID } from 'node:crypto';
import { withTransaction } from '../config/database.js';
import * as userRepository from '../repositories/user.repository.js';
import * as refreshTokenRepository from '../repositories/refreshToken.repository.js';
import * as auditLogRepository from '../repositories/auditLog.repository.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  newTokenId,
  hashToken,
  refreshTokenExpiry,
  accessTokenTtlSeconds,
} from '../utils/token.js';
import { conflict, unauthorized } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * A bcrypt hash of a throwaway secret, compared against when the email is unknown
 * so that login costs the same whether or not the account exists. Without it,
 * response timing leaks which emails are registered. Computed once, on first miss.
 */
let dummyHashPromise = null;
function dummyHash() {
  dummyHashPromise ||= hashPassword(randomUUID());
  return dummyHashPromise;
}

function toPublicUser(user) {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    created_at: user.created_at,
  };
}

/**
 * Issues an access/refresh pair and persists the refresh token digest.
 */
async function issueTokens(user, context, conn) {
  const jti = newTokenId();
  const refreshToken = signRefreshToken(user, jti);

  await refreshTokenRepository.insert(
    {
      userId: user.id,
      jti,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
      userAgent: context.userAgent ? String(context.userAgent).slice(0, 255) : null,
      ipAddress: context.ipAddress || null,
    },
    conn,
  );

  return {
    jti,
    accessToken: signAccessToken(user),
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: accessTokenTtlSeconds(),
  };
}

export async function register({ name, email, password }, context) {
  const passwordHash = await hashPassword(password);

  return withTransaction(async (conn) => {
    if (await userRepository.existsByEmail(email, conn)) {
      throw conflict('An account with this email already exists');
    }

    const user = await userRepository.create({ name, email, passwordHash }, conn);
    const tokens = await issueTokens(user, context, conn);

    await auditLogRepository.record(
      {
        userId: user.id,
        module: 'auth',
        table: 'users',
        recordId: user.id,
        action: 'register',
        newValue: { name: user.name, email: user.email },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      conn,
    );

    return { user: toPublicUser(user), tokens };
  });
}

export async function login({ email, password }, context) {
  const user = await userRepository.findByEmailWithSecret(email);
  const matches = await verifyPassword(password, user?.password_hash || (await dummyHash()));

  if (!user || !matches) {
    // Same message for both cases: never reveal whether the email exists.
    throw unauthorized('Invalid email or password');
  }

  return withTransaction(async (conn) => {
    const tokens = await issueTokens(user, context, conn);

    await auditLogRepository.record(
      {
        userId: user.id,
        module: 'auth',
        table: 'users',
        recordId: user.id,
        action: 'login',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      conn,
    );

    return { user: toPublicUser(user), tokens };
  });
}

/**
 * Rotates a refresh token: the presented token is revoked and a fresh pair issued.
 * Replaying an already-used token revokes the whole family, because a replay means
 * the token leaked.
 */
export async function refresh({ refreshToken }, context) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  // The rejection is returned rather than thrown from inside the transaction:
  // throwing would roll back the very revocation that reuse detection just wrote.
  const outcome = await withTransaction(async (conn) => {
    const stored = await refreshTokenRepository.findActiveLocked({ jti: payload.jti, tokenHash }, conn);

    if (!stored) {
      const known = await refreshTokenRepository.findAnyByJti(payload.jti, conn);
      if (known?.revoked_at) {
        // An already-used token is being replayed: assume it leaked and drop every
        // session for that account.
        await refreshTokenRepository.revokeAllForUser(known.user_id, conn);
        logger.warn(
          { userId: known.user_id, requestId: context.requestId },
          'Refresh token reuse detected; all sessions revoked',
        );
      }
      return { ok: false, reason: 'Invalid or expired refresh token' };
    }

    const user = await userRepository.findById(stored.user_id, conn);
    if (!user) return { ok: false, reason: 'Account no longer exists' };

    const tokens = await issueTokens(user, context, conn);
    await refreshTokenRepository.revoke({ jti: payload.jti, replacedByJti: tokens.jti }, conn);

    return { ok: true, user: toPublicUser(user), tokens };
  });

  if (!outcome.ok) throw unauthorized(outcome.reason);
  return { user: outcome.user, tokens: outcome.tokens };
}

/**
 * Logout (spec §3.1). The client drops its copy of the tokens; the server revokes
 * the refresh token so it cannot be used again even if it was captured.
 */
export async function logout({ refreshToken, userId }, context) {
  return withTransaction(async (conn) => {
    let revoked = 0;

    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        revoked = await refreshTokenRepository.revoke({ jti: payload.jti }, conn);
      } catch {
        // An unreadable token is not an error for logout: the client is signing out
        // either way, and reporting the difference would leak token validity.
      }
    }
    if (revoked === 0 && userId) {
      revoked = await refreshTokenRepository.revokeAllForUser(userId, conn);
    }

    if (userId) {
      await auditLogRepository.record(
        {
          userId,
          module: 'auth',
          table: 'users',
          recordId: userId,
          action: 'logout',
          newValue: { revoked_sessions: revoked },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
        },
        conn,
      );
    }

    return { revoked };
  });
}

export async function currentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw unauthorized('Account no longer exists');
  return toPublicUser(user);
}
