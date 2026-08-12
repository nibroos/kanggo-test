import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
  // `vuetify({ autoImport: true })` tree-shakes: only the components actually used
  // end up in the bundle.
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
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
    port: 5173,
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
});
