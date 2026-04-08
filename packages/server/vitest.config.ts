import { defineConfig } from 'vitest/config';
import { createTestEnv } from './test/testEnv.js';

const TEST_ENV = createTestEnv('server_test');

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', '__tests__/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    globalSetup: './test/globalSetup.server.ts',
    setupFiles: ['./test/setupServerEnv.ts'],
    env: TEST_ENV,
  },
});
