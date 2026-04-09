import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  appendTokenToRedirectUrl,
  decodeOAuthState,
  encodeOAuthState,
  getOAuthRedirectTarget,
} from './oauthRedirect.js';

describe('oauthRedirect', () => {
  const previousCorsOrigins = process.env.CORS_ORIGINS;

  beforeEach(() => {
    process.env.CORS_ORIGINS = 'http://localhost:5173,https://app.example.com';
  });

  afterEach(() => {
    process.env.CORS_ORIGINS = previousCorsOrigins;
  });

  it('prefers an explicitly requested allowed redirect URL', () => {
    expect(getOAuthRedirectTarget({
      requestedRedirect: 'https://app.example.com/lobby?room=ABCD',
      referer: 'http://localhost:5173/profile',
    })).toBe('https://app.example.com/lobby?room=ABCD');
  });

  it('uses state when the callback returns from Google', () => {
    const state = encodeOAuthState('http://localhost:5173/profile');
    expect(decodeOAuthState(state)).toBe('http://localhost:5173/profile');
    expect(getOAuthRedirectTarget({ state })).toBe('http://localhost:5173/profile');
  });

  it('falls back to the referer when it is allowed', () => {
    expect(getOAuthRedirectTarget({
      referer: 'http://localhost:5173/rooms/ABC123',
    })).toBe('http://localhost:5173/rooms/ABC123');
  });

  it('allows loopback callback redirects on ephemeral ports', () => {
    expect(getOAuthRedirectTarget({
      requestedRedirect: 'http://127.0.0.1:49231/?source=terminal',
    })).toBe('http://127.0.0.1:49231/?source=terminal');
  });

  it('falls back to the first allowed origin for unsafe redirects', () => {
    expect(getOAuthRedirectTarget({
      requestedRedirect: 'https://evil.example.com/phish',
      referer: 'not-a-url',
      state: encodeOAuthState('https://evil.example.com/elsewhere'),
    })).toBe('http://localhost:5173');
  });

  it('appends the token without dropping the existing path or query', () => {
    expect(appendTokenToRedirectUrl(
      'https://app.example.com/lobby?room=ABCD',
      'token-123',
    )).toBe('https://app.example.com/lobby?room=ABCD&token=token-123');
  });
});
