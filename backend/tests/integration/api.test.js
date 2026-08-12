import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prepareTestDatabase, truncateAll } from '../helpers/db.js';

/**
 * End-to-end API tests against a real MySQL schema (task_management_test).
 * Skipped automatically when no database is reachable, so `npm test` still runs
 * the unit suite on a fresh checkout.
 */
const { available, reason } = await prepareTestDatabase();
if (!available) {
  console.warn(`\n[skip] integration tests: no MySQL reachable.\n${String(reason).trim().slice(0, 300)}\n`);
}

const PASSWORD = 'Password123!';

describe.skipIf(!available)('Task Management API', () => {
  let app;
  let query;
  let closePool;

  /** Registers a user and returns their tokens and helper request headers. */
  async function signUp(email, name = 'Test User') {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name, email, password: PASSWORD })
      .expect(201);
    return {
      user: response.body.data.user,
      accessToken: response.body.data.accessToken,
      refreshToken: response.body.data.refreshToken,
      auth: { Authorization: `Bearer ${response.body.data.accessToken}` },
    };
  }

  async function createTask(auth, payload) {
    const response = await request(app).post('/api/tasks').set(auth).send(payload).expect(201);
    return response.body.data;
  }

  beforeAll(async () => {
    // Imported after prepareTestDatabase so the pool points at the migrated schema.
    ({ createApp: app } = await import('../../src/app.js'));
    app = app();
    ({ query, closePool } = await import('../../src/config/database.js'));
    await truncateAll(query);
  });

  afterAll(async () => {
    if (closePool) await closePool();
  });

  describe('health', () => {
    it('reports readiness with a live database', async () => {
      const response = await request(app).get('/ready').expect(200);
      expect(response.body.data.database).toBe('up');
    });
  });

  describe('registration and login', () => {
    it('registers a user, hashes the password and returns a token pair', async () => {
      const email = 'register@example.com';
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Ada Lovelace', email, password: PASSWORD })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({ name: 'Ada Lovelace', email });
      expect(response.body.data.accessToken).toBeTruthy();
      expect(response.body.data.refreshToken).toBeTruthy();

      const rows = await query('SELECT password_hash FROM users WHERE email = ?', [email]);
      expect(rows[0].password_hash).not.toBe(PASSWORD);
      expect(rows[0].password_hash.startsWith('$2')).toBe(true);
    });

    it('never returns the password hash in the response body', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'No Leak', email: 'noleak@example.com', password: PASSWORD })
        .expect(201);
      expect(JSON.stringify(response.body)).not.toContain('password');
    });

    it('rejects a duplicate email with 409', async () => {
      await signUp('duplicate@example.com');
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'Someone Else', email: 'duplicate@example.com', password: PASSWORD })
        .expect(409);
    });

    it('rejects invalid registration input with 422 and per-field errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'A', email: 'not-an-email', password: '123' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.map((error) => error.field).sort()).toEqual([
        'email',
        'name',
        'password',
      ]);
    });

    it('logs in with valid credentials', async () => {
      await signUp('login@example.com');
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: PASSWORD })
        .expect(200);
      expect(response.body.data.accessToken).toBeTruthy();
    });

    it('rejects a wrong password with 401 and a non-committal message', async () => {
      await signUp('wrongpass@example.com');
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrongpass@example.com', password: 'NotThePassword' })
        .expect(401);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('gives an unknown email the same answer as a wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: PASSWORD })
        .expect(401);
      expect(response.body.message).toBe('Invalid email or password');
    });
  });

  describe('JWT protection', () => {
    it('rejects task requests with no token', async () => {
      await request(app).get('/api/tasks').expect(401);
      await request(app).post('/api/tasks').send({ title: 'x' }).expect(401);
      await request(app).put('/api/tasks/1').send({ title: 'x' }).expect(401);
      await request(app).delete('/api/tasks/1').expect(401);
    });

    it('rejects a malformed or tampered token', async () => {
      await request(app).get('/api/tasks').set({ Authorization: 'Bearer nonsense' }).expect(401);
      const { accessToken } = await signUp('tamper@example.com');
      const tampered = `${accessToken.slice(0, -3)}abc`;
      await request(app).get('/api/tasks').set({ Authorization: `Bearer ${tampered}` }).expect(401);
    });

    it('rejects a refresh token used as an access token', async () => {
      const { refreshToken } = await signUp('wrongtype@example.com');
      await request(app).get('/api/tasks').set({ Authorization: `Bearer ${refreshToken}` }).expect(401);
    });
  });

  describe('task CRUD', () => {
    it('creates a task owned by the caller', async () => {
      const ada = await signUp('crud@example.com');
      const task = await createTask(ada.auth, {
        title: 'Write the README',
        description: 'Setup instructions',
        status: 'in-progress',
        deadline: '2026-09-01',
      });

      expect(task).toMatchObject({
        user_id: ada.user.id,
        title: 'Write the README',
        status: 'in-progress',
        deadline: '2026-09-01',
        version: 1,
      });
    });

    it('requires a title', async () => {
      const ada = await signUp('notitle@example.com');
      const response = await request(app)
        .post('/api/tasks')
        .set(ada.auth)
        .send({ description: 'orphan' })
        .expect(422);
      expect(response.body.errors[0].field).toBe('title');
    });

    it('updates every editable field', async () => {
      const ada = await signUp('update@example.com');
      const task = await createTask(ada.auth, { title: 'Before' });

      const response = await request(app)
        .put(`/api/tasks/${task.id}`)
        .set(ada.auth)
        .send({
          title: 'After',
          description: 'Now with a description',
          status: 'done',
          deadline: '2026-12-31',
          version: task.version,
        })
        .expect(200);

      expect(response.body.data).toMatchObject({
        title: 'After',
        description: 'Now with a description',
        status: 'done',
        deadline: '2026-12-31',
        version: 2,
      });
    });

    it('rejects a stale version with 409 instead of overwriting', async () => {
      const ada = await signUp('conflict@example.com');
      const task = await createTask(ada.auth, { title: 'Contended' });

      await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(ada.auth)
        .send({ status: 'done', version: task.version })
        .expect(200);

      await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(ada.auth)
        .send({ status: 'pending', version: task.version })
        .expect(409);
    });

    it('deletes an own task', async () => {
      const ada = await signUp('delete@example.com');
      const task = await createTask(ada.auth, { title: 'Temporary' });

      await request(app).delete(`/api/tasks/${task.id}`).set(ada.auth).expect(200);
      await request(app).get(`/api/tasks/${task.id}`).set(ada.auth).expect(404);
    });
  });

  describe('data ownership (spec §9)', () => {
    it('hides, refuses to update and refuses to delete another user\'s task', async () => {
      const ada = await signUp('owner@example.com', 'Ada');
      const mallory = await signUp('attacker@example.com', 'Mallory');
      const task = await createTask(ada.auth, { title: 'Private plan' });

      await request(app).get(`/api/tasks/${task.id}`).set(mallory.auth).expect(404);
      await request(app)
        .put(`/api/tasks/${task.id}`)
        .set(mallory.auth)
        .send({ title: 'Hijacked' })
        .expect(404);
      await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(mallory.auth)
        .send({ status: 'done' })
        .expect(404);
      await request(app).delete(`/api/tasks/${task.id}`).set(mallory.auth).expect(404);

      // The task is untouched and still belongs to its owner.
      const after = await request(app).get(`/api/tasks/${task.id}`).set(ada.auth).expect(200);
      expect(after.body.data).toMatchObject({ title: 'Private plan', user_id: ada.user.id });
    });

    it('never lists another user\'s tasks', async () => {
      const ada = await signUp('list-a@example.com');
      const bob = await signUp('list-b@example.com');
      await createTask(ada.auth, { title: 'Ada task 1' });
      await createTask(ada.auth, { title: 'Ada task 2' });
      await createTask(bob.auth, { title: 'Bob task' });

      const response = await request(app).get('/api/tasks?limit=100').set(bob.auth).expect(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].user_id).toBe(bob.user.id);
    });

    it('ignores a user_id supplied in the request body', async () => {
      const ada = await signUp('spoof-a@example.com');
      const bob = await signUp('spoof-b@example.com');

      const task = await createTask(ada.auth, { title: 'Mine', user_id: bob.user.id });
      expect(task.user_id).toBe(ada.user.id);
    });
  });

  describe('status filtering (spec §6)', () => {
    let ada;

    beforeAll(async () => {
      ada = await signUp('filter@example.com');
      await createTask(ada.auth, { title: 'P1', status: 'pending' });
      await createTask(ada.auth, { title: 'P2', status: 'pending' });
      await createTask(ada.auth, { title: 'I1', status: 'in-progress' });
      await createTask(ada.auth, { title: 'D1', status: 'done' });
    });

    it('returns everything without a status parameter', async () => {
      const response = await request(app).get('/api/tasks?limit=100').set(ada.auth).expect(200);
      expect(response.body.data).toHaveLength(4);
    });

    it.each([
      ['pending', 2],
      ['in-progress', 1],
      ['done', 1],
    ])('filters ?status=%s', async (status, expected) => {
      const response = await request(app).get(`/api/tasks?status=${status}`).set(ada.auth).expect(200);
      expect(response.body.data).toHaveLength(expected);
      expect(response.body.data.every((task) => task.status === status)).toBe(true);
    });

    it('rejects an unsupported status value', async () => {
      await request(app).get('/api/tasks?status=archived').set(ada.auth).expect(422);
    });

    it('reports per-status counts in meta', async () => {
      const response = await request(app).get('/api/tasks').set(ada.auth).expect(200);
      expect(response.body.meta.status_counts).toEqual({
        all: 4,
        pending: 2,
        'in-progress': 1,
        done: 1,
      });
    });
  });

  describe('default ordering', () => {
    let ada;

    beforeAll(async () => {
      ada = await signUp('ordering@example.com');
      // Deliberately created out of order, and one with no deadline at all.
      await createTask(ada.auth, { title: 'Later', deadline: '2027-01-15' });
      await createTask(ada.auth, { title: 'No deadline' });
      await createTask(ada.auth, { title: 'Soonest', deadline: '2026-01-05' });
      await createTask(ada.auth, { title: 'Middle', deadline: '2026-06-20' });
    });

    it('sorts by soonest deadline first, with undated tasks last', async () => {
      const response = await request(app).get('/api/tasks').set(ada.auth).expect(200);
      expect(response.body.data.map((task) => task.title)).toEqual([
        'Soonest',
        'Middle',
        'Later',
        'No deadline',
      ]);
    });

    it('reports the default in meta so the UI can reflect it', async () => {
      const response = await request(app).get('/api/tasks').set(ada.auth).expect(200);
      expect(response.body.meta.filters).toMatchObject({ sort_by: 'deadline', sort_dir: 'asc' });
    });

    it('keeps undated tasks last when the deadline sort is reversed', async () => {
      const response = await request(app)
        .get('/api/tasks?sort_by=deadline&sort_dir=desc')
        .set(ada.auth)
        .expect(200);
      expect(response.body.data.map((task) => task.title)).toEqual([
        'Later',
        'Middle',
        'Soonest',
        'No deadline',
      ]);
    });

    it('still honours an explicit sort override', async () => {
      const response = await request(app)
        .get('/api/tasks?sort_by=title&sort_dir=asc')
        .set(ada.auth)
        .expect(200);
      expect(response.body.data.map((task) => task.title)).toEqual([
        'Later',
        'Middle',
        'No deadline',
        'Soonest',
      ]);
    });
  });

  describe('pagination and search', () => {
    let ada;

    beforeAll(async () => {
      ada = await signUp('paging@example.com');
      for (let index = 1; index <= 25; index += 1) {
        // eslint-disable-next-line no-await-in-loop -- ordering matters for the assertions
        await createTask(ada.auth, { title: `Task ${String(index).padStart(2, '0')}` });
      }
      await createTask(ada.auth, { title: 'Unique needle in the haystack' });
    });

    it('paginates and reports accurate meta', async () => {
      const response = await request(app).get('/api/tasks?page=2&limit=10').set(ada.auth).expect(200);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.meta.pagination).toMatchObject({
        page: 2,
        limit: 10,
        total: 26,
        total_pages: 3,
        has_next_page: true,
        has_prev_page: true,
      });
    });

    it('returns an empty page past the end rather than an error', async () => {
      const response = await request(app).get('/api/tasks?page=99&limit=10').set(ada.auth).expect(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('searches by title', async () => {
      const response = await request(app).get('/api/tasks?search=needle').set(ada.auth).expect(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toContain('needle');
    });

    it('treats LIKE wildcards in the search term as literal characters', async () => {
      const response = await request(app).get('/api/tasks?search=%25').set(ada.auth).expect(200);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('refresh and logout', () => {
    it('rotates the refresh token and rejects the used one', async () => {
      const ada = await signUp('rotate@example.com');
      const rotated = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: ada.refreshToken })
        .expect(200);

      expect(rotated.body.data.refreshToken).not.toBe(ada.refreshToken);
      await request(app).post('/api/auth/refresh').send({ refreshToken: ada.refreshToken }).expect(401);
    });

    it('revokes the whole session family when a used token is replayed', async () => {
      const ada = await signUp('replay@example.com');
      const rotated = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: ada.refreshToken })
        .expect(200);

      // Replay the consumed token: treated as a leak.
      await request(app).post('/api/auth/refresh').send({ refreshToken: ada.refreshToken }).expect(401);
      // The token issued by the rotation is revoked as collateral.
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rotated.body.data.refreshToken })
        .expect(401);
    });

    it('revokes the refresh token on logout', async () => {
      const ada = await signUp('logout@example.com');
      await request(app)
        .post('/api/auth/logout')
        .set(ada.auth)
        .send({ refreshToken: ada.refreshToken })
        .expect(200);
      await request(app).post('/api/auth/refresh').send({ refreshToken: ada.refreshToken }).expect(401);
    });
  });

  describe('audit trail (policy §5)', () => {
    it('records create, update and delete with before/after values', async () => {
      const ada = await signUp('audit@example.com');
      const task = await createTask(ada.auth, { title: 'Audited' });
      await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(ada.auth)
        .send({ status: 'done', version: task.version })
        .expect(200);
      await request(app).delete(`/api/tasks/${task.id}`).set(ada.auth).expect(200);

      const rows = await query(
        'SELECT action, old_value, new_value FROM audit_logs WHERE table_name = ? AND record_id = ? ORDER BY id',
        ['tasks', String(task.id)],
      );
      expect(rows.map((row) => row.action)).toEqual(['create', 'update', 'delete']);

      const update = rows[1];
      const oldValue = typeof update.old_value === 'string' ? JSON.parse(update.old_value) : update.old_value;
      const newValue = typeof update.new_value === 'string' ? JSON.parse(update.new_value) : update.new_value;
      expect(oldValue.status).toBe('pending');
      expect(newValue.status).toBe('done');
    });
  });

  describe('error handling', () => {
    it('answers unknown routes with a 404 envelope', async () => {
      const response = await request(app).get('/api/nope').expect(404);
      expect(response.body.success).toBe(false);
    });

    it('rejects malformed JSON with 400, not a stack trace', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": ')
        .expect(400);
      expect(response.body.message).toBe('Request body is not valid JSON');
      expect(JSON.stringify(response.body)).not.toContain('at ');
    });
  });
});
