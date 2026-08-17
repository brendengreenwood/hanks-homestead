import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for pure modules under src/. Scoped to src/**/*.unit.test.ts so this
// runner never picks up the Playwright specs under tests/ (those stay on `playwright test`).
export default defineConfig({
  resolve: {
    alias: {
      omen: fileURLToPath(new URL('../packages/engine/src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.unit.test.ts'],
  },
});
