import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });  // repo root .env
loadEnv({ path: resolve(__dirname, '../.env') });        // packages/server/.env
loadEnv();                                               // cwd fallback

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth.js';
import { roomRoutes } from './routes/rooms.js';
import { createSocketServer } from './socket/index.js';
import { REST_RATE_LIMIT_PER_MINUTE } from '@poker/shared';

const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',');

async function main() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, { origin: CORS_ORIGINS, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: REST_RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
  });

  await app.register(authRoutes);
  await app.register(roomRoutes);

  await app.listen({ port: PORT, host: '0.0.0.0' });

  // Attach Socket.io to Fastify's underlying HTTP server after it's listening
  createSocketServer(app.server, CORS_ORIGINS);

  app.log.info(`Server running on port ${PORT}`);
}

main().catch(console.error);
