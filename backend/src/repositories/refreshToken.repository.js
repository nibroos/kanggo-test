import { query } from '../config/database.js';

/**
 * Refresh-token store. Rows hold the SHA-256 digest of the issued token, never the
 * token itself, and are matched on both jti and digest so a stolen jti alone is useless.
 */

export async function insert({ userId, jti, tokenHash, expiresAt, userAgent, ipAddress }, conn) {
  await query(
    `INSERT INTO refresh_tokens (user_id, jti, token_hash, expires_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, jti, tokenHash, expiresAt, userAgent, ipAddress],
    conn,
  );
}

/**
 * Locks the row while it is being rotated so two parallel refresh calls with the
 * same token cannot both succeed (policy §11).
 */
export async function findActiveLocked({ jti, tokenHash }, conn) {
  const rows = await query(
    `SELECT id, user_id, jti, expires_at, revoked_at
       FROM refresh_tokens
      WHERE jti = ?
        AND token_hash = ?
        AND revoked_at IS NULL
        AND expires_at > UTC_TIMESTAMP()
      LIMIT 1
      FOR UPDATE`,
    [jti, tokenHash],
    conn,
  );
  return rows[0] || null;
}

/**
 * Looks a token up regardless of state. Used to tell "never existed" apart from
 * "already used or revoked" — the latter means a leaked token is being replayed.
 */
export async function findAnyByJti(jti, conn = null) {
  const rows = await query(
    `SELECT id, user_id, jti, token_hash, expires_at, revoked_at
       FROM refresh_tokens
      WHERE jti = ?
      LIMIT 1`,
    [jti],
    conn,
  );
  return rows[0] || null;
}

export async function revoke({ jti, replacedByJti = null }, conn) {
  const result = await query(
    `UPDATE refresh_tokens
        SET revoked_at = UTC_TIMESTAMP(), replaced_by_jti = ?
      WHERE jti = ? AND revoked_at IS NULL`,
    [replacedByJti, jti],
    conn,
  );
  return result.affectedRows;
}

/**
 * Used when a revoked token is replayed: the whole family is dropped, because a
 * replay means the token leaked.
 */
export async function revokeAllForUser(userId, conn) {
  const result = await query(
    `UPDATE refresh_tokens
        SET revoked_at = UTC_TIMESTAMP()
      WHERE user_id = ? AND revoked_at IS NULL`,
    [userId],
    conn,
  );
  return result.affectedRows;
}

export async function deleteExpired(conn = null) {
  const result = await query(
    'DELETE FROM refresh_tokens WHERE expires_at < UTC_TIMESTAMP()',
    [],
    conn,
  );
  return result.affectedRows;
}
