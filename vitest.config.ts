import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'apps/*/tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@travel/shared': new URL('./packages/shared/src/index.ts', import.meta.url).pathname.replace(
        /^\/([A-Za-z]:)/,
        '$1',
      ),
    },
  },
});
