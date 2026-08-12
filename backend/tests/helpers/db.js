import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Integration tests need a real MySQL instance. Rather than failing a checkout
 * that has no database running, they report it as unavailable and skip — so
 * `npm test` still passes on the unit tests alone.
 */
export async function prepareTestDatabase() {
  try {
    await execFileAsync('node', ['scripts/migrate.js', 'up'], {
      cwd: backendRoot,
      env: process.env,
      timeout: 60_000,
    });
    return { available: true, reason: null };
  } catch (error) {
    return { available: false, reason: error.stderr || error.message };
  }
}

/**
 * Wipes the schema between runs. Deleting users cascades to tasks, refresh tokens
 * and audit logs through the foreign keys.
 */
export async function truncateAll(query) {
  await query('DELETE FROM audit_logs');
  await query('DELETE FROM refresh_tokens');
  await query('DELETE FROM tasks');
  await query('DELETE FROM users');
}
