import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests share one MySQL schema, so they must not run in parallel.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Separate schema: the suite truncates tables, so it must never point at the
      // development database.
      DB_NAME: 'task_management_test',
      JWT_ACCESS_SECRET: 'test_access_secret_0123456789abcdefghijklmno',
      JWT_REFRESH_SECRET: 'test_refresh_secret_0123456789abcdefghijklmno',
      // Lower cost factor: the suite hashes a lot of passwords and does not need
      // production-grade work per hash.
      BCRYPT_ROUNDS: '4',
    },
    include: ['tests/**/*.test.js'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
