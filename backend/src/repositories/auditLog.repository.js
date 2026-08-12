import { query } from '../config/database.js';

/**
 * Audit trail (policy §5). Written on the same connection as the change it
 * describes, so the log and the data commit or roll back together.
 */

// Anything in this list is stripped before a value is serialised into the log.
const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'token_hash',
  'accessToken',
  'refreshToken',
  'secret',
]);

function scrub(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrub);
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    output[key] = scrub(entry);
  }
  return output;
}

function serialise(value) {
  const scrubbed = scrub(value);
  return scrubbed === null ? null : JSON.stringify(scrubbed);
}

/**
 * @param {object} entry
 * @param {import('mysql2/promise').PoolConnection} [conn] transaction connection
 */
export async function record(entry, conn = null) {
  const {
    userId = null,
    module,
    table = null,
    recordId = null,
    action,
    oldValue = null,
    newValue = null,
    ipAddress = null,
    userAgent = null,
    requestId = null,
  } = entry;

  await query(
    `INSERT INTO audit_logs
       (user_id, module, table_name, record_id, action, old_value, new_value, ip_address, user_agent, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      module,
      table || module,
      recordId === null ? null : String(recordId),
      action,
      serialise(oldValue),
      serialise(newValue),
      ipAddress,
      userAgent ? String(userAgent).slice(0, 255) : null,
      requestId,
    ],
    conn,
  );
}
