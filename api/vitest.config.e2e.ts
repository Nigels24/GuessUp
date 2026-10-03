import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Every file uses the same real database; in parallel they slow each other
    // down enough to break the timer assertions.
    fileParallelism: false,
  },
});
