import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../auth/jwt.js';
import type { TokenPayload } from '../auth/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid authorization header' });
  }

  try {
    const token = authHeader.slice(7);
    request.user = verifyAccessToken(token);
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return;

  try {
    request.user = verifyAccessToken(authHeader.slice(7));
  } catch {
    // Silently ignore invalid tokens for optional auth
  }
}
