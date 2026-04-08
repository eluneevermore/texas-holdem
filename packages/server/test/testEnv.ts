import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../../');

loadEnv({ path: resolve(repoRoot, '.env.test') });

const baseDatabaseUrl = process.env.DATABASE_URL || 'postgresql://root:password@localhost:5222/poker_test';

export function createTestEnv(schema: string) {
  const databaseUrl = new URL(baseDatabaseUrl);
  databaseUrl.searchParams.set('schema', schema);

  return {
    DATABASE_URL: databaseUrl.toString(),
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret',
    NODE_ENV: process.env.NODE_ENV || 'test',
  };
}

export const TEST_ENV = createTestEnv('test');

export const SERVER_PACKAGE_ROOT = resolve(repoRoot, 'packages/server');
