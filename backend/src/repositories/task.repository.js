import { query } from '../config/database.js';

/**
 * Tasks repository.
 *
 * Two invariants hold for every statement in this file:
 *   1. `user_id = ?` is part of the WHERE clause of every read and write, so the
 *      database itself enforces ownership (spec §9) — there is no code path that
 *      can reach another user's row, even with a forged task id.
 *   2. Values are bound, never concatenated (policy §1.2). The only interpolated
 *      fragments are ORDER BY columns resolved through the whitelist below.
 */

const COLUMNS = 'id, user_id, title, description, status, deadline, version, created_at, updated_at';

const UPDATABLE_COLUMNS = new Set(['title', 'description', 'status', 'deadline']);

// Whitelist: user input selects a key, never a column name.
const SORTABLE_COLUMNS = {
  created_at: 'created_at',
  updated_at: 'updated_at',
  deadline: 'deadline',
  title: 'title',
  status: 'status',
};

/**
 * Builds the ORDER BY fragment from whitelisted keys only.
 *
 * Deadlines get an extra `IS NULL` term: MySQL sorts NULL first on ASC, which would
 * bury the most urgent tasks underneath every undated one. Tasks with no deadline
 * therefore sort last in both directions.
 */
function buildOrderBy(sortBy, sortDir) {
  const column = SORTABLE_COLUMNS[sortBy] || SORTABLE_COLUMNS.deadline;
  const direction = sortDir === 'asc' ? 'ASC' : 'DESC';
  const nullsLast = column === 'deadline' ? `${column} IS NULL, ` : '';
  // `id` is the tiebreaker so pages stay stable when the sort column ties.
  return `${nullsLast}${column} ${direction}, id ${direction}`;
}

function buildFilters({ userId, status, search }) {
  const where = ['user_id = ?'];
  const params = [userId];

  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (search) {
    where.push('title LIKE ?');
    // Escape LIKE wildcards so a literal % or _ in the search term stays literal.
    params.push(`%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`);
  }

  return { whereSql: where.join(' AND '), params };
}

/**
 * Paginated, filtered, searchable list (spec §5.2, §6, §18.1, §18.2; policy §1.5).
 * Written as raw SQL because policy §1.3 reserves pagination and search for SQL.
 */
export async function paginate({ userId, status, search, page, limit, sortBy, sortDir }) {
  const { whereSql, params } = buildFilters({ userId, status, search });
  const offset = (page - 1) * limit;

  const countRows = await query(`SELECT COUNT(*) AS total FROM tasks WHERE ${whereSql}`, params);
  const total = Number(countRows[0].total);

  const rows = await query(
    `SELECT ${COLUMNS}
       FROM tasks
      WHERE ${whereSql}
      ORDER BY ${buildOrderBy(sortBy, sortDir)}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { rows, total };
}

/**
 * Per-status counts in a single grouped query (policy §1.6: no N+1 — this replaces
 * one COUNT round-trip per filter tab).
 */
export async function countByStatus({ userId, search }) {
  const { whereSql, params } = buildFilters({ userId, search });
  const rows = await query(
    `SELECT status, COUNT(*) AS total
       FROM tasks
      WHERE ${whereSql}
      GROUP BY status`,
    params,
  );

  const counts = { all: 0, pending: 0, 'in-progress': 0, done: 0 };
  for (const row of rows) {
    counts[row.status] = Number(row.total);
    counts.all += Number(row.total);
  }
  return counts;
}

export async function findByIdForUser(id, userId, conn = null) {
  const rows = await query(
    `SELECT ${COLUMNS} FROM tasks WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId],
    conn,
  );
  return rows[0] || null;
}

/**
 * Row-level lock for read-modify-write flows (policy §11). Must run inside a
 * transaction; `conn` is therefore required.
 */
export async function findByIdForUserLocked(id, userId, conn) {
  const rows = await query(
    `SELECT ${COLUMNS} FROM tasks WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
    [id, userId],
    conn,
  );
  return rows[0] || null;
}

export async function insert({ userId, title, description, status, deadline }, conn) {
  const result = await query(
    `INSERT INTO tasks (user_id, title, description, status, deadline)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, title, description, status, deadline],
    conn,
  );
  return findByIdForUser(result.insertId, userId, conn);
}

/**
 * Updates a task, guarded by both the owner and the optimistic-lock version
 * (policy §1.8). Returns the number of affected rows so the service can tell a
 * version conflict apart from a missing row.
 */
export async function updateOwned({ id, userId, version, fields }, conn) {
  const assignments = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    // Defensive whitelist: column names cannot be bound as parameters, so nothing
    // outside this fixed set is ever allowed into the SQL text.
    if (!UPDATABLE_COLUMNS.has(key)) {
      throw new Error(`Attempted to update non-updatable column "${key}"`);
    }
    assignments.push(`${key} = ?`);
    params.push(value);
  }
  assignments.push('version = version + 1');

  const result = await query(
    `UPDATE tasks
        SET ${assignments.join(', ')}
      WHERE id = ? AND user_id = ? AND version = ?`,
    [...params, id, userId, version],
    conn,
  );
  return result.affectedRows;
}

export async function deleteOwned({ id, userId }, conn) {
  const result = await query('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, userId], conn);
  return result.affectedRows;
}
