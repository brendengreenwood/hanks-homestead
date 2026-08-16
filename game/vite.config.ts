import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // omen is a source-only workspace package (no build step); vite consumes
    // its TS directly. String aliases prefix-match, covering deep paths too.
    alias: {
      omen: fileURLToPath(new URL('../packages/engine/src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5183,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4183,
    strictPort: true,
  },
  build: {
    sourcemap: true,
  },
});
