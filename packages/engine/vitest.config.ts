import { defineConfig } from 'vitest/config';

// Unit tests colocated with engine modules under src/.
export default defineConfig({
  test: {
    include: ['src/**/*.unit.test.ts'],
  },
});
