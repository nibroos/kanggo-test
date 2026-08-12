# Task Management System

A small fullstack task manager: users register, sign in, and manage their own
private task list. Every task belongs to exactly one user, and the API refuses to
show or touch anybody else's tasks — even if a task id is guessed or forged.

```
Vue 3 + Vuetify + Pinia   ──HTTPS/JSON──>   Express + JWT   ──SQL──>   MySQL 8
        (frontend)                             (backend)
```
live on: https://kanggo-fe.nibros.space

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

- [Tech stack](#tech-stack)
- [Quick start with Docker](#quick-start-with-docker)
- [Development with live reload](#development-with-live-reload)
- [Manual setup](#manual-setup)
  - [Prerequisites](#prerequisites)
  - [Database setup](#database-setup)
  - [Backend setup](#backend-setup)
  - [Frontend setup](#frontend-setup)
- [Demo accounts](#demo-accounts)
- [Environment variables](#environment-variables)
  - [One file for everything](#one-file-for-everything)
- [API documentation](#api-documentation)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Design notes](#design-notes)
- [Troubleshooting](#troubleshooting)
- [Screenshots](#screenshots)

---

## Tech stack

Versions are the ones this project was built and verified against.

### Backend

| Layer | Choice | Version | Why |
| ----- | ------ | ------- | --- |
| Runtime | **Node.js** | 22 LTS | Required by the spec |
| Framework | **Express** | 4.22 | Required by the spec; small, explicit middleware model |
| Database | **MySQL** | 8.4 | Required by the spec |
| Driver | **mysql2** (`/promise`) | 3.23 | Promise API, real connection pooling, parameter binding |
| Query style | Hand-written SQL, no ORM | — | Policy §1.3 reserves raw SQL for pagination, search and aggregates; the rest of the surface is small enough that an ORM would add indirection without removing work |
| Auth | **jsonwebtoken** | 9.0 | JWT access tokens plus rotating refresh tokens |
| Password hashing | **bcrypt** | 5.1 | Required by the spec; cost factor 12 |
| Validation | **zod** | 3.25 | Schemas sanitise *and* validate, and map cleanly onto per-field API errors |
| Security headers | **helmet** | 8.3 | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS |
| CORS | **cors** | 2.8 | Explicit origin allowlist, never `*` |
| Rate limiting | **express-rate-limit** | 7.5 | 5 failed credential attempts/min, 300 req/min globally |
| Compression | **compression** | 1.8 | gzip on JSON responses |
| Logging | **pino** + **pino-http** | 9.14 / 10.5 | Structured JSON logs with request id, user id, latency; secrets redacted |
| Config | **dotenv** | 16.6 | Environment variables, validated at startup |
| API docs | **swagger-ui-express** + **yaml** | 5.0 / 2.9 | Serves `docs/openapi.yaml` at `/api/docs` |
| Migrations | Custom runner (`scripts/migrate.js`) | — | ~120 lines over plain `.sql` files with checksums — no migration framework needed for four tables |
| Dev reload | **nodemon** | 3.1 | Polling watcher — reliable through a Docker bind mount on any host OS |
| Tests | **vitest** + **supertest** | 2.1 / 7.2 | Unit tests plus real HTTP integration tests against MySQL |

### Frontend

| Layer | Choice | Version | Why |
| ----- | ------ | ------- | --- |
| Framework | **Vue 3** (Composition API, `<script setup>`) | 3.5 | Required by the spec |
| UI library | **Vuetify 3** | 3.13 | Required by the spec; Material components with responsive and a11y behaviour built in |
| State | **Pinia** | 2.3 | Required by the spec; setup-style stores for auth, tasks and UI feedback |
| Routing | **Vue Router** | 4.6 | History mode with an auth guard on protected routes |
| HTTP | **axios** | 1.19 | One instance with interceptors for bearer tokens, error shaping and transparent token refresh |
| Icons | **@mdi/font** | 7.4 | Material Design Icons, self-hosted |
| Build | **Vite** + **vite-plugin-vuetify** | 6.4 / 2.1 | Fast dev server; the plugin tree-shakes unused Vuetify components |
| Styling | Vuetify theming + scoped CSS | — | Light and dark palettes defined once in `plugins/vuetify.js` |
| Tests | **vitest** + **@vue/test-utils** + **jsdom** | 2.1 / 2.4 / 25 | Component, store and full app-boot tests |

### Infrastructure and tooling

| Concern | Choice | Notes |
| ------- | ------ | ----- |
| Containers | **Docker Compose** | MySQL 8.4, backend, and the frontend behind nginx |
| Dev environment | **Docker Compose** (`docker-compose.dev.yml`) + **Makefile** | `make dev` — bind-mounted source, HMR on the frontend, auto-restart on the API |
| Web server | **nginx** 1.27 alpine | Serves the built SPA with history fallback, gzip, long-lived asset caching and security headers |
| API docs | **OpenAPI 3.0** + **Postman v2.1** | `backend/docs/` |
| Screenshots | **Puppeteer** (`scripts/screenshots.mjs`) | Regenerates every image in this README from the running app |

---

## Quick start with Docker

The fastest path — nothing but Docker required.

```bash
git clone https://github.com/nibroos/kanggo-test.git
cd kanggo-test

cp .env.example .env                  # optional — every value has a default

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
> alongside other local projects. Override them with `DB_PORT`, `PORT` and
> `FRONTEND_PORT` in the root `.env`.
>
> A single root `.env` configures everything — the compose files, the API and the
> frontend. See [Environment variables](#environment-variables).

Stop everything (add `-v` to also drop the database volume):

```bash
docker compose down
```

> This stack builds the code into images, which is right for a demo but means a
> rebuild per change. For actual development use
> [the live-reload stack](#development-with-live-reload) — `make dev`.

---

## Development with live reload

The stack in [Quick start](#quick-start-with-docker) bakes the code into images, so
every change needs a rebuild. For day-to-day work use the development stack
instead: the source is bind-mounted, the API restarts on save, and the frontend
hot-swaps modules in the browser without losing page state.

```bash
make dev            # or: docker compose -f docker-compose.dev.yml up -d --build
make seed           # optional demo data, once the stack is up
make dev-logs       # follow both services
```

| Service | URL | Behaviour on save |
| ------- | --- | ----------------- |
| Frontend | http://localhost:5173 | Vite HMR — the module is swapped in place, no page reload |
| API | http://localhost:4088/api | nodemon restarts the process (~1s) |
| MySQL | `localhost:3307` | Same container and volume as the production-like stack |

Migrations run automatically when the backend container starts, so a fresh clone is
one command from a working environment.

### Make targets

```
make dev            start the dev stack (live reload)
make dev-deps       reinstall node_modules in the containers (after a package.json change)
make dev-logs       tail backend + frontend logs
make dev-down       stop it (database volume kept)

make prod           the built stack: nginx on :4089
make prod-down      stop it

make migrate        apply pending migrations
make seed           load demo data
make reset          drop the database volume and start clean + seeded
make db             open a MySQL shell

make test           run both test suites inside the containers
make screenshots    regenerate the README screenshots
```

Every target is a plain `docker compose` command — run them by hand if you prefer.

### How the dev stack works

[`docker-compose.dev.yml`](docker-compose.dev.yml) is **self-contained** — pass it on
its own, never together with `docker-compose.yml`. Both files use the same project
name, container names and database volume, so the two stacks share their data and
only one can run at a time; `make dev` and `make prod` switch between them.

- **Separate image stages.** Both Dockerfiles gained a `dev` stage, and each compose
  file pins its `target` (`dev` / `runtime`) so neither build can drift into the
  other. The dev images are tagged `:dev` so the two stacks do not overwrite each
  other's builds.
- **Database settings come from compose, not from `.env`.** `backend/.env` is inside
  the bind mount and points at `127.0.0.1:3307` — right from the host, but inside the
  container that address is the container itself. The compose file sets
  `DB_HOST=mysql` explicitly, and since `dotenv` never overwrites a variable that is
  already set, the compose value wins.
- **Bind mount plus an anonymous volume.** `./backend:/app` makes host edits visible
  instantly, and a second, anonymous volume on `/app/node_modules` stops the host's
  copy from shadowing the one built inside the image — which matters because bcrypt
  compiles a native binding.
- **Containers run as uid 1000** (the node image's `node` user), so nothing the
  container writes into your working tree ends up owned by root.
- **The API watcher polls.** inotify events do not cross a bind mount reliably: they
  are lost entirely on macOS and Windows hosts, and even on Linux they are missed
  when an editor saves by writing a temp file and renaming over the original.
  `node --watch` silently stopped picking up changes after the first restart during
  testing, so the container runs `nodemon --legacy-watch`. Polling a few directories
  costs almost nothing and behaves the same on every host.
- **Vite watches natively** and picks up changes over the bind mount on Linux. If
  edits are not detected on macOS or Windows, set `VITE_USE_POLLING=true` and
  restart — [`vite.config.js`](frontend/vite.config.js) reads it.

### Notes

- **After changing `package.json`,** run `make dev-deps`. The anonymous
  `node_modules` volume survives a plain `up --build`, so a new dependency would
  otherwise be missing inside the container.
- **`.env` is optional in dev.** Compose supplies every setting the backend needs. If
  a `backend/.env` exists it is still read, but compose values win — `dotenv` does
  not overwrite variables that are already set.
- **Running without Docker** works too: `npm run dev` in `backend/` (nodemon with
  native file watching) and in `frontend/`. See [Manual setup](#manual-setup).

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
cp .env.example .env      # in the repo root — one file configures everything

cd backend
npm install
```

Edit the root `.env` if needed. The defaults point at the MySQL that
`docker compose up -d mysql` publishes on `127.0.0.1:3307`; set two real JWT
secrets while you are there:

```bash
openssl rand -hex 32      # once per secret
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
npm run dev               # http://localhost:5173
```

`VITE_API_BASE_URL` comes from the root `.env` (default
`http://localhost:4088/api`), so there is nothing else to copy.

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

## Environment variables

### One file for everything

There is a single [`.env`](.env.example), in the repository root. It is read by all
three ways of running the project:

| Consumer | How it reads the root `.env` |
| -------- | ---------------------------- |
| **Docker Compose** | Fills the `${...}` placeholders in both compose files, *and* is passed into the containers via `env_file:` |
| **Backend on the host** (`npm run dev`) | `dotenv`, configured in [`src/config/env.js`](backend/src/config/env.js) |
| **Frontend on the host** (`npm run dev`) | Vite, via `loadEnv` in [`vite.config.js`](frontend/vite.config.js) |

```bash
cp .env.example .env
openssl rand -hex 32      # once per JWT secret
```

Every value has a working default, so both stacks start without this file at all.

**Values that must differ inside a container are pinned by the compose files.** The
root `.env` holds `DB_HOST=127.0.0.1` and `DB_PORT=3307`, which is what the API needs
when you run it on your machine against the published MySQL port. Inside a container
those addresses point at the container itself, so both compose files override them
with `DB_HOST=mysql` and `DB_PORT=3306` under `environment:`, which takes precedence
over `env_file:`. Everything else — pool sizes, bcrypt cost, rate limits, seed
settings — flows through from the one file unchanged.

Precedence, most specific first:

```
1. real environment variables   (compose `environment:`, CI, `DB_HOST=… npm start`)
2. backend/.env, frontend/.env  (optional; not present in this repository)
3. .env at the repository root
```

Per-service `.env` files are still honoured if you create one — handy for a local
override you do not want to share — but nothing here needs them. They are excluded
by each `.dockerignore`, so they never enter a build context: `/app/.env` does not
exist in the production image.

Real secrets never belong in the repository: `.env` is gitignored, and only
`.env.example` is committed.

### Reference

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `NODE_ENV` | `development` | `development` \| `production` \| `test`. Both compose files pin their own value. |
| `PORT` | `4088` | API port — where it listens, and where Docker publishes it |
| `LOG_LEVEL` | `info` | pino level: `trace`…`fatal`, or `silent` |
| `DB_HOST` | `127.0.0.1` | MySQL host. Compose overrides to `mysql`. |
| `DB_PORT` | `3307` | MySQL port from the host, and the port Docker publishes. Compose overrides to `3306` inside the network. |
| `DB_USER` | `task_user` | MySQL user, created in the container |
| `DB_PASSWORD` | `task_password` | MySQL password |
| `DB_NAME` | `task_management` | Database name |
| `MYSQL_ROOT_PASSWORD` | `root_password` | MySQL root account (container setup only) |
| `DB_POOL_MAX` | `10` | Max open pool connections |
| `DB_POOL_IDLE` | `10` | Max idle connections |
| `DB_IDLE_TIMEOUT_MS` | `60000` | Idle connection lifetime |
| `DB_CONNECT_TIMEOUT_MS` | `10000` | Connection timeout |
| `DB_QUERY_TIMEOUT_MS` | `8000` | Per-query timeout |
| `JWT_ACCESS_SECRET` | placeholder | Access-token secret (≥ 32 chars in production) — **replace for anything beyond local use** |
| `JWT_REFRESH_SECRET` | placeholder | Refresh-token secret — must differ from the access secret |
| `JWT_ACCESS_TTL` | `15m` | Access-token lifetime |
| `JWT_REFRESH_TTL_DAYS` | `30` | Refresh-token lifetime in days |
| `JWT_ISSUER` | `task-management-api` | `iss` claim |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4088,http://localhost:4089` | Comma-separated allowlist — never `*` |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `RATE_LIMIT_GLOBAL_MAX` | `300` | Requests per window per IP |
| `RATE_LIMIT_AUTH_MAX` | `5` | Failed auth attempts per window per IP |
| `PAGINATION_DEFAULT_LIMIT` | `10` | Default page size |
| `PAGINATION_MAX_LIMIT` | `100` | Maximum page size a client may ask for |
| `VITE_API_BASE_URL` | `http://localhost:4088/api` | Where the browser reaches the API. Baked into the bundle by the production build; read at start-up by the dev server. |
| `FRONTEND_PORT` | `4089` | Host port for the built frontend behind nginx |
| `VITE_PORT` | `5173` | Host port for the Vite dev server |
| `VITE_USE_POLLING` | *(empty)* | `true` forces Vite to poll for file changes |
| `SEED_USER_COUNT` / `SEED_TASKS_MIN` / `SEED_TASKS_MAX` / `SEED_PASSWORD` | `12` / `20` / `30` / `Password123!` | Demo data generated by `npm run seed` |

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
│   │   ├── services/                axios instance, API clients, token + filter storage
│   │   ├── router/                  routes + auth guard
│   │   └── utils/                   validation rules, formatting
│   └── tests/                       components, stores, app boot
│
├── docker/mysql/init/               first-run SQL (test schema)
├── docs/screenshots/                README screenshots, generated
├── scripts/screenshots.mjs          regenerates them from the running app
├── .env.example                     the one config file: ports, credentials, secrets
├── docker-compose.yml               built images: nginx + API + MySQL
├── docker-compose.dev.yml           dev stack: bind mounts, HMR, auto-restart
├── Makefile                         make dev / prod / seed / test / reset
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

**`up -d` says "Started" but the backend is missing from `docker ps`.** It started
and then exited, so only `docker ps -a` shows it. Read the reason with
`docker compose -f docker-compose.dev.yml logs backend`. The usual cause is mixing
the two compose files: `docker-compose.dev.yml` is self-contained and must be passed
**on its own**. Combining it with `docker-compose.yml`, or running the base file with
dev overrides, produces a container that is missing `DB_HOST=mysql` and falls back to
the `127.0.0.1:3307` in `backend/.env` — which inside the container points at the
container itself, so migrations fail with `ECONNREFUSED` and the process exits.

**Port already in use.** Override `DB_PORT`, `PORT` or `FRONTEND_PORT`
for Compose, or `PORT` for a manual backend run.

**`Migration ... was modified after being applied`.** An applied migration file
changed. Restore it and add a new migration instead — or, in development,
`docker compose down -v` and start over.

---

## Screenshots

Every image below is a real capture of the running application, produced by
[`scripts/screenshots.mjs`](scripts/screenshots.mjs) driving a headless browser
against the Docker stack. To regenerate them after a UI change:

```bash
docker compose up -d                       # stack must be running
docker compose exec backend npm run seed   # and seeded
npm i -D puppeteer                         # one-off, downloads its own Chrome
node scripts/screenshots.mjs               # writes docs/screenshots/*.png
```

### Authentication

| Login | Validation feedback |
| --- | --- |
| ![Login page](docs/screenshots/01-login.png) | ![Empty submit shows per-field errors](docs/screenshots/02-login-validation.png) |
| Email, password, and a link to registration. | Submitting empty blocks the request and marks both fields. |

| Rejected credentials | Registration |
| --- | --- |
| ![Invalid email or password](docs/screenshots/03-login-error.png) | ![Register page with strength meter](docs/screenshots/04-register.png) |
| A wrong password returns `401` with a message that does not reveal whether the account exists. | Name, email and password, with a live password strength meter. |

### Route protection

| Guard redirects anonymous visitors | After logout |
| --- | --- |
| ![Visiting /tasks without a token lands on login](docs/screenshots/05-route-protection.png) | ![Protected page unreachable once signed out](docs/screenshots/19-protected-after-logout.png) |
| `/tasks` requested with no token: the router guard sends the visitor to `/login`. | The same guard applies once the token is cleared. The API rejects the requests independently. |

### Task list

![Task list](docs/screenshots/06-task-list.png)

The authenticated page: task cards showing title, description, status and deadline,
sorted by soonest deadline with overdue dates flagged in red. Counts per status sit
in the filter tabs, and the header shows the total.

### Status filtering

| Pending | In Progress | Done |
| --- | --- | --- |
| ![Pending filter](docs/screenshots/07-filter-pending.png) | ![In Progress filter](docs/screenshots/07-filter-in-progress.png) | ![Done filter](docs/screenshots/07-filter-done.png) |

Each tab issues `GET /api/tasks?status=…`; filtering happens in SQL, not in the browser.
Completed tasks are struck through.

### Search and pagination

| Title search | Page 2 |
| --- | --- |
| ![Debounced search by title](docs/screenshots/08-search.png) | ![Server-side pagination](docs/screenshots/14-pagination.png) |
| Live search, debounced to one request when typing stops. | Server-side pagination over the seeded 20–30 tasks per user. |

### Creating, editing and deleting

| Create dialog | Created |
| --- | --- |
| ![New task dialog](docs/screenshots/09-create-dialog.png) | ![Task created confirmation](docs/screenshots/10-create-success.png) |
| Title required; description, status and deadline optional, with quick-set date chips. | The submit button is disabled while the request is in flight, so a double click cannot create two tasks. |

| Form validation | Edit dialog |
| --- | --- |
| ![Title is required](docs/screenshots/11-form-validation.png) | ![Edit dialog pre-filled](docs/screenshots/12-edit-dialog.png) |
| An empty title never reaches the network — and the API enforces the same rule. | Editing pre-fills the current values and carries the row `version` for conflict detection. |

![Delete confirmation](docs/screenshots/13-delete-confirmation.png)

Deleting always asks first, and names the task being removed.

### Filter persistence

![Filters restored after a reload](docs/screenshots/15-filters-persisted.png)

The Pinia store writes the status tab, search term, sort order and page to
`localStorage`. This is the page immediately after a browser refresh — the Pending
filter is still applied.

### Theme and responsive layout

| Dark theme | Mobile (414 × 896) |
| --- | --- |
| ![Dark theme](docs/screenshots/16-dark-mode.png) | ![Mobile layout](docs/screenshots/17-responsive-mobile.png) |
| Follows the operating system preference, with a manual toggle that is remembered. | Filter tabs collapse into a select, cards stack to one column, and logout moves into the avatar menu. |

### Logout and error states

| Signed out | Unknown route |
| --- | --- |
| ![Back at the login page after logout](docs/screenshots/18-logout.png) | ![404 page](docs/screenshots/20-not-found.png) |
| Logout clears the client token and revokes the refresh token server-side. | Unmatched routes render a 404 page rather than a blank screen. |

### API documentation

![Swagger UI](docs/screenshots/21-swagger-ui.png)

Swagger UI served by the API itself at `/api/docs`, generated from
[`backend/docs/openapi.yaml`](backend/docs/openapi.yaml).

---
