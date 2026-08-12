import mysql from 'mysql2/promise';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Single shared connection pool (policy §7: connection pool must be configured
 * explicitly). Every query in this codebase goes through `query` or `withTransaction`
 * so that parameter binding and query timeouts are never accidentally skipped.
 */
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  maxIdle: config.db.maxIdle,
  idleTimeout: config.db.idleTimeout,
  connectTimeout: config.db.connectTimeout,
  queueLimit: 0,
  enableKeepAlive: true,
  timezone: 'Z',
  dateStrings: ['DATE'],
  namedPlaceholders: false,
  // MySQL DECIMAL/BIGINT can exceed JS number range; ids stay safe as numbers here
  // because we use BIGINT UNSIGNED AUTO_INCREMENT well below 2^53.
  supportBigNumbers: true,
});

/**
 * Runs a parameterised query. Policy §1.2: SQL is never built by concatenation,
 * values are always bound.
 *
 * @param {string} sql SQL text with `?` placeholders
 * @param {Array<unknown>} params bound values
 * @param {import('mysql2/promise').PoolConnection} [conn] optional transaction connection
 */
export async function query(sql, params = [], conn = null) {
  const executor = conn || pool;
  const [rows] = await executor.query({ sql, timeout: config.db.queryTimeout }, params);
  return rows;
}

/**
 * Policy §1.1: every CREATE / UPDATE / DELETE runs inside a transaction, rolls
 * back on any error and commits only when all statements succeeded.
 *
 * @template T
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<T>} handler
 * @returns {Promise<T>}
 */
export async function withTransaction(handler) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await handler(conn);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      logger.error({ err: rollbackError }, 'Transaction rollback failed');
    }
    throw error;
  } finally {
    conn.release();
  }
}

export async function pingDatabase() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}

export async function closePool() {
  await pool.end();
}
