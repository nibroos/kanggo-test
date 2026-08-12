# Task Management System

A small fullstack task manager: users register, sign in, and manage their own
private task list. Every task belongs to exactly one user, and the API refuses to
show or touch anybody else's tasks — even if a task id is guessed or forged.

```
Vue 3 + Vuetify + Pinia   ──HTTPS/JSON──>   Express + JWT   ──SQL──>   MySQL 8
        (frontend)                             (backend)
```

**Features**

- Register, sign in, sign out, JWT access tokens with refresh-token rotation
- Route protection on the client and JWT verification middleware on the server
- Task CRUD with title, description, status (`pending` / `in-progress` / `done`) and deadline
- Status filter, title search, sorting and server-side pagination — sorted by
  soonest deadline by default, and the filters survive a page reload
- Ownership enforced in every query — a task id from another account returns `404`
- Validation on both sides, friendly error handling, responsive light/dark UI
- Bonus: search, pagination, seed data (12 users × 20–30 tasks), OpenAPI + Postman
  docs, 108 automated tests, Docker Compose

---

## Table of contents

- [Quick start with Docker](#quick-start-with-docker)
- [Manual setup](#manual-setup)
  - [Prerequisites](#prerequisites)
  - [Database setup](#database-setup)
  - [Backend setup](#backend-setup)
  - [Frontend setup](#frontend-setup)
- [Demo accounts](#demo-accounts)
- [Environment variables](#environment-variables)
- [API documentation](#api-documentation)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Design notes](#design-notes)
- [Policy compliance and deviations](#policy-compliance-and-deviations)
- [Troubleshooting](#troubleshooting)

---

## Quick start with Docker

The fastest path — nothing but Docker required.

```bash
git clone https://github.com/nibroos/kanggo-test.git
cd kanggo-test

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker compose up -d --build          # MySQL + API + frontend
docker compose exec backend npm run migrate
docker compose exec backend npm run seed   # optional demo data
```

| Service    | URL                                |
| ---------- | ---------------------------------- |
| Frontend   | http://localhost:4089              |
| API        | http://localhost:4088/api          |
| API docs   | http://localhost:4088/api/docs     |
| Health     | http://localhost:4088/health       |
| MySQL      | `localhost:3307` (user `task_user`) |

Sign in with `ada.lovelace1@example.com` / `Password123!`, or register a new account.

> Host ports are deliberately non-default (3307 / 4088 / 4089) so the stack can run
> alongside other local projects. Override them with `DB_HOST_PORT`, `BACKEND_PORT`
> and `FRONTEND_PORT`.

Stop everything (add `-v` to also drop the database volume):

```bash
docker compose down
```

---

## Manual setup

### Prerequisites

| Tool    | Version | Notes                                          |
| ------- | ------- | ---------------------------------------------- |
| Node.js | ≥ 20    | Developed on 22 LTS                            |
| npm     | ≥ 10    | Ships with Node                                |
| MySQL   | ≥ 8.0   | 5.7 works too — it needs the `JSON` column type |

### Database setup

The application needs a database and a user that can reach it. Either run just the
database from Compose:

```bash
docker compose up -d mysql
```

…or create it by hand in your own MySQL instance:

```sql
CREATE DATABASE task_management
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'task_user'@'%' IDENTIFIED BY 'task_password';
GRANT ALL PRIVILEGES ON task_management.* TO 'task_user'@'%';

-- Optional: the schema used by the automated tests
CREATE DATABASE task_management_test
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON task_management_test.* TO 'task_user'@'%';

FLUSH PRIVILEGES;
```

**Applying the schema.** Two equivalent options:

```bash
cd backend
npm run migrate          # versioned migrations (recommended)
npm run migrate:status   # show applied / pending
```

or load the one-file snapshot:

```bash
mysql -u root -p < backend/schema.sql
```

`npm run migrate` creates the database if it does not exist, applies every file in
`backend/migrations/` in order, and records each one in `schema_migrations` with a
checksum — so re-running it is a no-op and editing an already-applied migration is
reported as an error instead of silently diverging.

**Tables**

| Table            | Purpose                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `users`          | Account: name, unique email, bcrypt hash                            |
| `tasks`          | `user_id` FK → `users.id` (1:N, `ON DELETE CASCADE`), plus `version` for optimistic locking |
| `refresh_tokens` | SHA-256 digests of issued refresh tokens, with rotation and revocation |
| `audit_logs`     | Login/logout/create/update/delete trail with old and new values     |

### Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` — at minimum the `DB_*` values and two real JWT secrets:

```bash
# generate one for each secret
openssl rand -hex 32
```

Then:

```bash
npm run migrate      # apply the schema
npm run seed         # optional: 12 demo users with 20-30 tasks each
npm run dev          # http://localhost:4088  (npm start for production mode)
```

The process refuses to start if a mandatory environment variable is missing or the
database is unreachable, so a misconfiguration fails immediately and loudly rather
than as a 500 on the first request.

### Frontend setup

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_BASE_URL=http://localhost:4088/api
npm run dev               # http://localhost:5173
```

Production build:

```bash
npm run build             # -> dist/
npm run preview
```

> `VITE_API_BASE_URL` is inlined at build time. If you change it, restart the dev
> server or rebuild. The backend's `CORS_ORIGINS` must list the origin the frontend
> is served from, otherwise the browser will block the responses.

---

## Demo accounts

After `npm run seed` (12 users, 20–30 tasks each — enough to exercise pagination):

| Email                            | Password       |
| -------------------------------- | -------------- |
| `ada.lovelace1@example.com`      | `Password123!` |
| `grace.hopper2@example.com`      | `Password123!` |
| `alan.turing3@example.com`       | `Password123!` |
| …through `anita.borg12@example.com` | `Password123!` |

Signing in as two different users side by side is the quickest way to see that
task lists are completely separate.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `4088` | HTTP port |
| `LOG_LEVEL` | `info` | pino level: `trace`…`fatal`, or `silent` |
| `DB_HOST` | — **required** | MySQL host (`mysql` inside Compose) |
| `DB_PORT` | — **required** | MySQL port (`3307` from the host, `3306` inside Compose) |
| `DB_USER` | — **required** | MySQL user |
| `DB_PASSWORD` | `''` | MySQL password |
| `DB_NAME` | — **required** | Database name |
| `DB_POOL_MAX` | `10` | Max open pool connections |
| `DB_POOL_IDLE` | `10` | Max idle connections |
| `DB_IDLE_TIMEOUT_MS` | `60000` | Idle connection lifetime |
| `DB_CONNECT_TIMEOUT_MS` | `10000` | Connection timeout |
| `DB_QUERY_TIMEOUT_MS` | `8000` | Per-query timeout |
| `JWT_ACCESS_SECRET` | — **required** | Access-token signing secret (≥ 32 chars in production) |
| `JWT_REFRESH_SECRET` | — **required** | Refresh-token signing secret — must differ from the access secret |
| `JWT_ACCESS_TTL` | `15m` | Access-token lifetime |
| `JWT_REFRESH_TTL_DAYS` | `30` | Refresh-token lifetime in days |
| `JWT_ISSUER` | `task-management-api` | `iss` claim |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowlist — never `*` |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `RATE_LIMIT_GLOBAL_MAX` | `300` | Requests per window per IP |
| `RATE_LIMIT_AUTH_MAX` | `5` | Failed auth attempts per window per IP |
| `PAGINATION_DEFAULT_LIMIT` | `10` | Default page size |
| `PAGINATION_MAX_LIMIT` | `100` | Maximum page size a client may ask for |
| `SEED_*` | see `.env.example` | Seed volume and demo password |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `VITE_API_BASE_URL` | `http://localhost:4088/api` | Backend base URL, inlined at build time |

Real secrets never belong in the repository: `.env` is gitignored and only
`.env.example` is committed.

---

## API documentation

- **Swagger UI** — http://localhost:4088/api/docs (raw document at `/api/docs.json`)
- **OpenAPI 3** — [`backend/docs/openapi.yaml`](backend/docs/openapi.yaml)
- **Postman** — [`backend/docs/postman_collection.json`](backend/docs/postman_collection.json)
  (run *Auth → Login* first; the token is captured into collection variables automatically)

| Endpoint | Method | Auth | Purpose |
| -------- | ------ | ---- | ------- |
| `/api/auth/register` | POST | No | Register a user |
| `/api/auth/login` | POST | No | Authenticate, receive a token pair |
| `/api/auth/refresh` | POST | No | Exchange a refresh token for a new pair |
| `/api/auth/logout` | POST | Yes | Revoke the session |
| `/api/auth/me` | GET | Yes | The authenticated user |
| `/api/tasks` | GET | Yes | The caller's tasks (filter, search, paginate) |
| `/api/tasks` | POST | Yes | Create a task |
| `/api/tasks/:id` | GET | Yes | Read one of the caller's tasks |
| `/api/tasks/:id` | PUT | Yes | Replace one of the caller's tasks |
| `/api/tasks/:id` | PATCH | Yes | Partially update one of the caller's tasks |
| `/api/tasks/:id` | DELETE | Yes | Delete one of the caller's tasks |
| `/health`, `/live`, `/ready` | GET | No | Probes |

### Status filter

```http
GET /api/tasks?status=pending
GET /api/tasks?status=in-progress
GET /api/tasks?status=done
GET /api/tasks                      # no filter: every task the user owns
```

Other list parameters: `search`, `page`, `limit`, `sort_by`
(`created_at` | `updated_at` | `deadline` | `title` | `status`), `sort_dir` (`asc` | `desc`).

**Default order is `sort_by=deadline&sort_dir=asc`** — the soonest deadline first.
Tasks without a deadline always sort last, in both directions: MySQL places `NULL`
first on an ascending sort, which would otherwise bury the most urgent tasks
underneath every undated one.

### Response format

Success:

```json
{
  "success": true,
  "message": "Tasks retrieved",
  "data": [ { "id": 1, "title": "Write the README", "status": "pending" } ],
  "meta": {
    "pagination": { "page": 1, "limit": 10, "total": 26, "total_pages": 3,
                    "has_next_page": true, "has_prev_page": false },
    "filters": { "status": "all", "search": null, "sort_by": "deadline", "sort_dir": "asc" },
    "status_counts": { "all": 26, "pending": 12, "in-progress": 7, "done": 7 }
  }
}
```

Error:

```json
{
  "success": false,
  "message": "Validation Error",
  "errors": [ { "field": "title", "message": "Title is required" } ]
}
```

Status codes: `200` OK · `201` Created · `400` Bad Request · `401` Unauthorized ·
`404` Not Found · `409` Conflict · `422` Validation Error · `429` Too Many Requests ·
`500` Internal Server Error.

### Quick curl walkthrough

```bash
API=http://localhost:4088/api

TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ada.lovelace1@example.com","password":"Password123!"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.accessToken')

curl -s "$API/tasks?status=pending&limit=5" -H "Authorization: Bearer $TOKEN"

curl -s -X POST $API/tasks -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Write the README","status":"in-progress","deadline":"2026-09-01"}'
```

---

## Testing

```bash
cd backend  && npm test     # 64 tests: 25 unit + 39 integration
cd frontend && npm test     # 44 tests: components, stores, validation, app boot
```

The backend integration suite runs against a real MySQL schema
(`task_management_test`) and covers registration, login, JWT protection, CRUD,
**cross-user ownership**, status filtering, pagination, search, refresh-token
rotation and reuse detection, the audit trail and error handling. If no database
is reachable it prints a notice and skips, so the unit suite still runs on a bare
checkout.

The frontend suite covers the validation rules, the presentation helpers, the
`TaskCard` component, the task store (filters, persistence, pagination edge cases,
conflict handling) and an app-boot test that mounts the real router, guards, stores
and views against a stubbed HTTP layer.

---

## Project structure

```
task-management-system/
├── backend/
│   ├── migrations/                  versioned SQL migrations
│   ├── schema.sql                   full schema snapshot
│   ├── scripts/                     migrate.js, seed.js
│   ├── docs/                        openapi.yaml, postman_collection.json
│   ├── src/
│   │   ├── config/                  env validation, connection pool, transactions
│   │   ├── routes/                  URL -> middleware -> controller
│   │   ├── controllers/             HTTP in/out only
│   │   ├── services/                business rules, transactions, audit
│   │   ├── repositories/            SQL; every statement scoped by user_id
│   │   ├── middlewares/             auth, validation, rate limit, errors, logging
│   │   ├── validators/              zod schemas
│   │   └── utils/                   response envelope, tokens, errors, sanitising
│   └── tests/                       unit + integration
│
├── frontend/
│   ├── src/
│   │   ├── views/                   Login, Register, Tasks, NotFound
│   │   ├── components/              TaskCard, TaskFilters, TaskFormDialog, ConfirmDialog…
│   │   ├── stores/                  Pinia: auth, tasks, ui
│   │   ├── services/                axios instance, API clients, token storage
│   │   ├── router/                  routes + auth guard
│   │   └── utils/                   validation rules, formatting
│   └── tests/
│
├── docker/mysql/init/               first-run SQL (test schema)
├── docker-compose.yml
└── README.md
```

Layering is strict: `route → controller → service → repository → database`. There
is no business logic in a controller and no SQL outside a repository.

---

## Design notes

**Ownership.** Every task statement carries `user_id = ?` in its `WHERE` clause,
and `user_id` comes only from the verified JWT — never from the body, the query or
a header. A task belonging to another account answers `404`, not `403`, so the API
never confirms that an id exists elsewhere. Updates and deletes take a `FOR UPDATE`
row lock inside a transaction, so a concurrent edit cannot interleave.

**Tokens.** Access tokens live 15 minutes; refresh tokens 30 days and rotate on
every use. Only the SHA-256 digest of a refresh token is stored, so a database dump
cannot be replayed. Replaying an already-used token is treated as a leak and revokes
every session for that account. On the client, a 401 triggers one transparent
refresh-and-retry; if that fails the session is cleared and the user is returned to
the login page with the destination remembered.

**No cookies, no CSRF.** Tokens travel in the `Authorization` header and live in
`localStorage`. Because no ambient credential is attached to cross-site requests,
CSRF is not reachable — which is why there are no CSRF tokens in this codebase.
The trade-off is XSS exposure, mitigated by Vue's default escaping and the absence
of any `v-html`. A same-site `HttpOnly` refresh cookie would be the stronger choice
once the app is served from a single origin behind one domain.

**Optimistic locking.** Tasks carry a `version`. The client sends the version it
edited; a mismatch returns `409` with a "reload and try again" message rather than
silently discarding somebody's work. Omitting `version` falls back to last-write-wins,
so plain `curl` usage stays simple.

**Validation.** zod schemas sanitise first (trim, collapse whitespace, normalise
Unicode, strip control characters, lowercase emails) and then validate. Handlers
only ever see parsed data. The frontend mirrors the rules for immediate feedback,
but the backend never trusts it.

**Filter persistence.** The task store is the single source of truth for the status
tab, search term, sort order, page and page size, and it writes that block to
`localStorage` on every change and hydrates from it when the store is created — so a
refresh lands you exactly where you left off. Stored values are re-validated against
the same whitelists the API accepts before they are used, because `localStorage` is
user-writable and a hand-edited value must never reach a request. Signing out clears
the stored filters along with the session.

**Errors.** One error boundary maps `AppError`s to their status and reduces
everything else to a bare `500` — no SQL text, no stack traces. Full detail goes to
the structured log with the request id, which is also returned in `X-Request-Id`.

---

### Implemented

Transactions around every write · parameter binding everywhere (no string-built SQL) ·
explicit column lists (no `SELECT *`) · raw SQL for pagination and search, simple
statements for CRUD · pagination on every list endpoint · indexes on the primary key,
foreign keys and every filtered/sorted/searched column · no N+1 (status counts are one
grouped query) · optimistic locking · full input validation and sanitisation ·
JWT with refresh-token rotation · ownership checked on every operation · REST
conventions with correct status codes · one response envelope · structured logging ·
audit log with old/new values · connection pool and timeouts configured · gzip ·
security headers · CORS allowlist · rate limiting (5/min on credentials) · no secrets
in code · error boundary that never leaks internals · row locks against races ·
health/live/ready probes · unit and integration tests · versioned migrations ·
config from the environment with fail-fast startup validation · loading states,
double-submit prevention and delete confirmation in the UI · modular, documented,
accessible, responsive components.

---

## Troubleshooting

**`Cannot reach the database` on startup.** MySQL is not up yet or `DB_*` is wrong.
Check `docker compose ps` and confirm `DB_PORT` — it is `3307` from the host but
`3306` from inside the Compose network.

**Frontend loads but every request fails.** Either `VITE_API_BASE_URL` points
somewhere the API is not, or the frontend's origin is missing from the backend's
`CORS_ORIGINS`. The browser console will say which. Remember Vite inlines the URL at
build time — restart the dev server after changing it.

**`Access denied for user 'task_user'` when running tests.** The test schema does not
exist yet. Run the `CREATE DATABASE task_management_test` grant from
[Database setup](#database-setup), or recreate the Compose volume
(`docker compose down -v`) so the init script runs.

**429 on login.** The rate limiter allows five failed attempts per minute per IP.
Wait a minute, or raise `RATE_LIMIT_AUTH_MAX` in development.

**Port already in use.** Override `DB_HOST_PORT`, `BACKEND_PORT` or `FRONTEND_PORT`
for Compose, or `PORT` for a manual backend run.

**`Migration ... was modified after being applied`.** An applied migration file
changed. Restore it and add a new migration instead — or, in development,
`docker compose down -v` and start over.
