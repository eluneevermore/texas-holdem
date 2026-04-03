import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { createServer } from 'http';
import { authRoutes } from './routes/auth.js';
import { roomRoutes } from './routes/rooms.js';
import { createSocketServer } from './socket/index.js';
import { REST_RATE_LIMIT_PER_MINUTE } from '@poker/shared';

const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',');

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: CORS_ORIGINS, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: REST_RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
  });

  await app.register(authRoutes);
  await app.register(roomRoutes);

  // Create HTTP server and attach Socket.io
  const httpServer = createServer(app.server);
  createSocketServer(httpServer, CORS_ORIGINS);

  // Use Fastify's server through the HTTP server
  await app.ready();

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch(console.error);
