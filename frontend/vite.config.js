import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig(({ mode }) => {
  /**
   * Configuration is layered, most specific first:
   *
   *   1. the real environment  (Docker Compose, CI, `VITE_API_BASE_URL=… npm run dev`)
   *   2. frontend/.env         optional, for frontend-only overrides
   *   3. .env at the repo root the single file that configures the whole project
   *
   * `loadEnv` already folds the first two together, so anything it does not know
   * about is filled in from the root file — one .env is enough to run the app on
   * the host as well as in a container.
   */
  const here = fileURLToPath(new URL('.', import.meta.url));
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));

  const localEnv = loadEnv(mode, here, 'VITE_');
  const rootEnv = loadEnv(mode, repoRoot, 'VITE_');
  for (const [key, value] of Object.entries(rootEnv)) {
    if (localEnv[key] === undefined) process.env[key] = value;
  }

  return {
    // `vuetify({ autoImport: true })` tree-shakes: only the components actually used
    // end up in the bundle.
    plugins: [vue(), vuetify({ autoImport: true })],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: Number(process.env.VITE_PORT) || 5173,
      // 0.0.0.0, so the dev server is reachable when it runs inside a container.
      host: true,
      watch: {
        // Bind mounts do not always forward inotify events (macOS, Windows, some
        // network filesystems). Set VITE_USE_POLLING=true when edits are not picked up.
        usePolling: process.env.VITE_USE_POLLING === 'true',
        interval: 300,
      },
    },
    preview: {
      port: Number(process.env.VITE_PORT) || 5173,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['tests/**/*.test.js'],
      setupFiles: ['tests/setup.js'],
      server: {
        deps: { inline: ['vuetify'] },
      },
    },
  };
});
