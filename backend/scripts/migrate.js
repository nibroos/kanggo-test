#!/usr/bin/env node
/**
 * Minimal versioned migration runner (policy §16: every schema change goes through
 * a versioned, repeatable, reviewable migration — never a manual ALTER).
 *
 * Usage:
 *   npm run migrate          apply every pending migration
 *   npm run migrate:status   list applied / pending migrations
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config, assertConfig } from '../src/config/env.js';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const TRACKING_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(191) NOT NULL,
    checksum   CHAR(64)     NOT NULL,
    applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;`;

async function connect({ withDatabase = true } = {}) {
  return mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: withDatabase ? config.db.database : undefined,
    multipleStatements: true,
    connectTimeout: config.db.connectTimeout,
  });
}

/** Creates the database when it does not exist yet, so a fresh clone can bootstrap. */
async function ensureDatabase() {
  const conn = await connect({ withDatabase: false });
  try {
    // The database name comes from configuration, not from user input, and is
    // validated against a strict pattern because identifiers cannot be bound.
    if (!/^[A-Za-z0-9_]+$/.test(config.db.database)) {
      throw new Error(`Unsafe database name in DB_NAME: "${config.db.database}"`);
    }
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\`
       DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await conn.end();
  }
}

async function readMigrations() {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  const files = entries.filter((file) => file.endsWith('.sql')).sort();
  return Promise.all(
    files.map(async (file) => {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      return {
        version: file.replace(/\.sql$/, ''),
        sql,
        checksum: crypto.createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
}

async function up() {
  await ensureDatabase();
  const conn = await connect();
  try {
    await conn.query(TRACKING_TABLE);
    const migrations = await readMigrations();
    const [applied] = await conn.query('SELECT version, checksum FROM schema_migrations');
    const appliedMap = new Map(applied.map((row) => [row.version, row.checksum]));

    let count = 0;
    for (const migration of migrations) {
      const previous = appliedMap.get(migration.version);
      if (previous) {
        if (previous !== migration.checksum) {
          throw new Error(
            `Migration ${migration.version} was modified after being applied. ` +
              'Create a new migration instead of editing an applied one.',
          );
        }
        continue;
      }
      process.stdout.write(`  applying ${migration.version} ... `);
      await conn.query(migration.sql);
      await conn.query('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)', [
        migration.version,
        migration.checksum,
      ]);
      process.stdout.write('done\n');
      count += 1;
    }
    console.log(count === 0 ? 'Database is already up to date.' : `Applied ${count} migration(s).`);
  } finally {
    await conn.end();
  }
}

async function status() {
  await ensureDatabase();
  const conn = await connect();
  try {
    await conn.query(TRACKING_TABLE);
    const migrations = await readMigrations();
    const [applied] = await conn.query('SELECT version, applied_at FROM schema_migrations');
    const appliedMap = new Map(applied.map((row) => [row.version, row.applied_at]));
    for (const migration of migrations) {
      const at = appliedMap.get(migration.version);
      console.log(`${at ? 'applied ' : 'pending '} ${migration.version}${at ? `  (${at.toISOString()})` : ''}`);
    }
  } finally {
    await conn.end();
  }
}

const command = process.argv[2] || 'up';

try {
  assertConfig();
  if (command === 'up') await up();
  else if (command === 'status') await status();
  else {
    console.error(`Unknown command "${command}". Use "up" or "status".`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
}
