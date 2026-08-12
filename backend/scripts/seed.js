#!/usr/bin/env node
/**
 * Demo data (spec §18.2: 12 users with 20-30 tasks each, enough rows to exercise
 * pagination, search and the status filter).
 *
 *   npm run seed
 *
 * Idempotent: existing seed accounts are reused and their tasks replaced, so the
 * script can be run repeatedly without piling up duplicates.
 */
import { config, assertConfig } from '../src/config/env.js';
import { query, withTransaction, closePool } from '../src/config/database.js';
import { hashPassword } from '../src/utils/password.js';
import * as userRepository from '../src/repositories/user.repository.js';

const USER_COUNT = Number(process.env.SEED_USER_COUNT || 12);
const TASKS_MIN = Number(process.env.SEED_TASKS_MIN || 20);
const TASKS_MAX = Number(process.env.SEED_TASKS_MAX || 30);
const PASSWORD = process.env.SEED_PASSWORD || 'Password123!';

const PEOPLE = [
  'Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson',
  'Linus Torvalds', 'Margaret Hamilton', 'Dennis Ritchie', 'Barbara Liskov',
  'Ken Thompson', 'Radia Perlman', 'Guido van Rossum', 'Anita Borg',
];

const VERBS = ['Draft', 'Review', 'Refactor', 'Deploy', 'Investigate', 'Document', 'Migrate', 'Test', 'Plan', 'Fix'];
const OBJECTS = [
  'the onboarding flow', 'the payment webhook', 'the reporting query', 'the login page',
  'the audit log module', 'the nightly backup', 'the search index', 'the invoice export',
  'the notification worker', 'the API rate limiter', 'the database migration', 'the mobile layout',
];
const STATUSES = ['pending', 'in-progress', 'done'];

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (items) => items[randomInt(0, items.length - 1)];

function slugEmail(name, index) {
  const local = name.toLowerCase().replace(/[^a-z]+/g, '.');
  return `${local}${index}@example.com`;
}

function randomDeadline() {
  // ~15% of tasks have no deadline; the rest land within +/- 30 days of today.
  if (Math.random() < 0.15) return null;
  const date = new Date();
  date.setDate(date.getDate() + randomInt(-30, 30));
  return date.toISOString().slice(0, 10);
}

function buildTasks(userId) {
  const count = randomInt(TASKS_MIN, TASKS_MAX);
  return Array.from({ length: count }, () => [
    userId,
    `${pick(VERBS)} ${pick(OBJECTS)}`,
    Math.random() < 0.7 ? `Auto-generated demo task for load and pagination testing.` : null,
    pick(STATUSES),
    randomDeadline(),
  ]);
}

async function seed() {
  assertConfig();
  console.log(`Seeding ${USER_COUNT} users with ${TASKS_MIN}-${TASKS_MAX} tasks each ...`);

  // One hash for every demo account: bcrypt at cost 12 is deliberately slow, and
  // hashing the same password 12 times would dominate the runtime for no benefit.
  const passwordHash = await hashPassword(PASSWORD);
  let totalTasks = 0;

  for (let index = 0; index < USER_COUNT; index += 1) {
    const name = PEOPLE[index % PEOPLE.length];
    const email = slugEmail(name, index + 1);

    // eslint-disable-next-line no-await-in-loop -- sequential on purpose: keeps the
    // connection pool free and the output readable for a one-off script.
    await withTransaction(async (conn) => {
      let user = await userRepository.findByEmailWithSecret(email, conn);
      if (!user) {
        user = await userRepository.create({ name, email, passwordHash }, conn);
      } else {
        await query('DELETE FROM tasks WHERE user_id = ?', [user.id], conn);
      }

      const rows = buildTasks(user.id);
      // Single multi-row INSERT instead of one round trip per task (policy §1.6).
      await query(
        'INSERT INTO tasks (user_id, title, description, status, deadline) VALUES ?',
        [rows],
        conn,
      );
      totalTasks += rows.length;
      console.log(`  ${email.padEnd(32)} ${String(rows.length).padStart(2)} tasks`);
    });
  }

  console.log(`\nDone: ${USER_COUNT} users, ${totalTasks} tasks.`);
  console.log(`Sign in with any address above, password: ${PASSWORD}`);
  console.log(`Database: ${config.db.database} @ ${config.db.host}:${config.db.port}`);
}

seed()
  .catch((error) => {
    console.error(`Seeding failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
