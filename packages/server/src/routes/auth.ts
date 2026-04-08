import type { FastifyInstance } from 'fastify';
import { v4 as uuid } from 'uuid';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/jwt.js';
import { upsertUserByEmail } from '../db/userRepository.js';
import {
  appendTokenToRedirectUrl,
  encodeOAuthState,
  getOAuthRedirectTarget,
} from '../auth/oauthRedirect.js';

export async function authRoutes(app: FastifyInstance) {
  // Guest session creation
  app.post('/auth/guest', async (_request, reply) => {
    const guestId = uuid();
    const guestNum = Math.floor(Math.random() * 9000) + 1000;
    const displayName = `Guest#${guestNum}`;

    const payload = { userId: guestId, displayName, isGuest: true };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    });

    return { guestId, displayName, accessToken };
  });

  // Google OAuth initiation — redirects to Google
  app.get('/auth/google', async (request, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
    if (!clientId || !callbackUrl) {
      return reply.status(500).send({ error: 'Google OAuth not configured' });
    }
    const { redirect } = request.query as { redirect?: string };
    const redirectTarget = getOAuthRedirectTarget({
      requestedRedirect: redirect,
      referer: request.headers.referer,
    });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      state: encodeOAuthState(redirectTarget),
    });
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // Google OAuth callback
  app.get('/auth/google/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    if (!code) return reply.status(400).send({ error: 'Missing authorization code' });

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_CALLBACK_URL,
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenRes.json() as { id_token?: string; access_token?: string };

      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoRes.json() as { email: string; name: string; picture?: string };

      const user = await upsertUserByEmail({
        email: userInfo.email,
        displayName: userInfo.name,
        avatarUrl: userInfo.picture,
      });

      const payload = { userId: user.id, displayName: user.displayName, isGuest: false };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/auth/refresh',
        maxAge: 7 * 24 * 60 * 60,
      });

      const redirectTarget = getOAuthRedirectTarget({ state });
      return reply.redirect(appendTokenToRedirectUrl(redirectTarget, accessToken));
    } catch (error) {
      return reply.status(500).send({ error: 'OAuth authentication failed' });
    }
  });

  // Token refresh
  app.post('/auth/refresh', async (request, reply) => {
    const refreshToken = (request.cookies as Record<string, string>)?.refreshToken;
    if (!refreshToken) {
      return reply.status(401).send({ error: 'No refresh token' });
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      const accessToken = signAccessToken({
        userId: payload.userId,
        displayName: payload.displayName,
        isGuest: payload.isGuest,
      });
      return { accessToken };
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });

  // Logout
  app.post('/auth/logout', async (_request, reply) => {
    reply.clearCookie('refreshToken', { path: '/auth/refresh' });
    return { ok: true };
  });
}
