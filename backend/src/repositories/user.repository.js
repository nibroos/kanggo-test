import { query } from '../config/database.js';

/**
 * Users repository. Policy §1.4: columns are always listed explicitly, never `SELECT *`,
 * so the password hash can only leave this module when a caller asks for it by name.
 */

const PUBLIC_COLUMNS = 'id, name, email, created_at, updated_at';

export async function findById(id, conn = null) {
  const rows = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [id], conn);
  return rows[0] || null;
}

/**
 * Only used by the login flow: returns the hash alongside the public columns.
 */
export async function findByEmailWithSecret(email, conn = null) {
  const rows = await query(
    `SELECT id, name, email, password_hash, created_at, updated_at
       FROM users
      WHERE email = ?
      LIMIT 1`,
    [email],
    conn,
  );
  return rows[0] || null;
}

export async function existsByEmail(email, conn = null) {
  const rows = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email], conn);
  return rows.length > 0;
}

export async function create({ name, email, passwordHash }, conn) {
  const result = await query(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    [name, email, passwordHash],
    conn,
  );
  return findById(result.insertId, conn);
}
