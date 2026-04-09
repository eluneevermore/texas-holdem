function getAllowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string): boolean {
  if (getAllowedOrigins().includes(origin)) return true;

  try {
    const candidate = new URL(origin);
    if (!isLoopbackHostname(candidate.hostname)) return false;

    return getAllowedOrigins().some((allowedOrigin) => {
      try {
        const allowed = new URL(allowedOrigin);
        return candidate.protocol === allowed.protocol && isLoopbackHostname(allowed.hostname);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function encodeOAuthState(redirectUrl: string): string {
  return Buffer.from(JSON.stringify({ redirectUrl }), 'utf8').toString('base64url');
}

export function decodeOAuthState(state?: string): string | null {
  if (!state) return null;

  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
      redirectUrl?: unknown;
    };
    return typeof parsed.redirectUrl === 'string' ? parsed.redirectUrl : null;
  } catch {
    return null;
  }
}

export function resolveOAuthRedirectCandidate(candidate?: string): string | null {
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return isAllowedOrigin(url.origin) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getOAuthRedirectTarget(options: {
  requestedRedirect?: string;
  referer?: string;
  state?: string;
}): string {
  const requested = resolveOAuthRedirectCandidate(options.requestedRedirect);
  if (requested) return requested;

  const fromState = resolveOAuthRedirectCandidate(decodeOAuthState(options.state) ?? undefined);
  if (fromState) return fromState;

  const fromReferer = resolveOAuthRedirectCandidate(options.referer);
  if (fromReferer) return fromReferer;

  return getAllowedOrigins()[0] || 'http://localhost:5173';
}

export function appendTokenToRedirectUrl(redirectUrl: string, accessToken: string): string {
  const url = new URL(redirectUrl);
  url.searchParams.set('token', accessToken);
  return url.toString();
}
