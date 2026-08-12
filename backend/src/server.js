import { createApp } from './app.js';
import { config, assertConfig } from './config/env.js';
import { pingDatabase, closePool } from './config/database.js';
import { logger } from './utils/logger.js';

/**
 * Startup sequence. Policy §19: a missing mandatory setting or an unreachable
 * database fails the process here rather than surfacing as a 500 on first use.
 */
async function main() {
  assertConfig();

  try {
    await pingDatabase();
    logger.info({ database: config.db.database, host: config.db.host }, 'Database connection established');
  } catch (error) {
    logger.error(
      { err: error },
      'Cannot reach the database. Check DB_* settings and that MySQL is running.',
    );
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.env, docs: `http://localhost:${config.port}/api/docs` },
      'Task Management API started',
    );
  });

  // Slowloris protection and sane socket timeouts (policy §7).
  server.headersTimeout = 20_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 15_000;

  const shutdown = (signal) => async () => {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      try {
        await closePool();
      } catch (error) {
        logger.error({ err: error }, 'Error while closing the connection pool');
      }
      process.exit(0);
    });
    // Give in-flight requests 10s, then exit anyway.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception, exiting');
    process.exit(1);
  });
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start the server');
  process.exit(1);
});
