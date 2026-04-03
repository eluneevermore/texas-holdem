import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: 'postgresql://root:password@localhost:5222/poker_test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-jwt-secret',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
      NODE_ENV: 'test',
    },
  },
});
