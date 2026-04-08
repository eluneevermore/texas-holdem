import { defineConfig } from 'vitest/config';
import { createTestEnv } from '../server/test/testEnv.js';

const TEST_ENV = createTestEnv('terminal_test');

export default defineConfig({
  test: {
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    globalSetup: '../server/test/globalSetup.terminal.ts',
    setupFiles: ['../server/test/setupTerminalEnv.ts'],
    env: TEST_ENV,
  },
});
