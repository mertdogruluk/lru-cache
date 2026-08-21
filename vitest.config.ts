import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],

    // `vitest bench` picks these up; they never run as part of `vitest run`, so a slow
    // benchmark can never slow the test suite down.
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },

    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],

      // The entry point only re-exports; there is no logic in it to cover.
      exclude: ['src/index.ts'],
      reporter: ['text', 'lcov'],

      // The cache core is small and fully reachable. Anything less than complete coverage
      // here means a branch nobody has reasoned about.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
