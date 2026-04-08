import { execFileSync } from 'child_process';
import { SERVER_PACKAGE_ROOT, createTestEnv } from './testEnv.js';

export default function globalSetup() {
  const testEnv = createTestEnv('terminal_test');
  const dbUrl = new URL(testEnv.DATABASE_URL);
  if (dbUrl.pathname !== '/poker_test') {
    throw new Error(`Refusing to reset non-test database: ${testEnv.DATABASE_URL}`);
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force', '--skip-generate'], {
    cwd: SERVER_PACKAGE_ROOT,
    env: {
      ...process.env,
      ...testEnv,
    },
    stdio: 'inherit',
  });
}
