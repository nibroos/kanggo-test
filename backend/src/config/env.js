import 'dotenv/config';

/**
 * Centralised configuration. Policy §19: configuration comes from environment
 * variables and the application must fail at startup when a mandatory value is
 * missing (instead of failing later, in production, on the first request).
 */

const REQUIRED = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_NAME',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`);
  }
  return parsed;
}

function list(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function assertConfig() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing mandatory environment variables: ${missing.join(', ')}`);
  }
  if (process.env.NODE_ENV === 'production') {
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
      if (process.env[key].length < 32) {
        throw new Error(`${key} must be at least 32 characters in production`);
      }
    }
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: int('PORT', 4088),
  logLevel: process.env.LOG_LEVEL || 'info',

  db: {
    host: process.env.DB_HOST,
    port: int('DB_PORT', 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    // Policy §7: explicit pool sizing and timeouts.
    connectionLimit: int('DB_POOL_MAX', 10),
    maxIdle: int('DB_POOL_IDLE', 10),
    idleTimeout: int('DB_IDLE_TIMEOUT_MS', 60_000),
    connectTimeout: int('DB_CONNECT_TIMEOUT_MS', 10_000),
    queryTimeout: int('DB_QUERY_TIMEOUT_MS', 8_000),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    // Policy §3: access token 15-30 minutes, refresh token 7-30 days.
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtlDays: int('JWT_REFRESH_TTL_DAYS', 30),
    issuer: process.env.JWT_ISSUER || 'task-management-api',
  },

  security: {
    bcryptRounds: int('BCRYPT_ROUNDS', 12),
    corsOrigins: list('CORS_ORIGINS', ['http://localhost:5173']),
    rateLimitWindowMs: int('RATE_LIMIT_WINDOW_MS', 60_000),
    rateLimitGlobalMax: int('RATE_LIMIT_GLOBAL_MAX', 300),
    rateLimitAuthMax: int('RATE_LIMIT_AUTH_MAX', 5),
  },

  pagination: {
    defaultLimit: int('PAGINATION_DEFAULT_LIMIT', 10),
    maxLimit: int('PAGINATION_MAX_LIMIT', 100),
  },
};
