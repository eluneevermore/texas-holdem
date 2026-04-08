import { createTestEnv } from './testEnv.js';

Object.assign(process.env, createTestEnv('server_test'));
