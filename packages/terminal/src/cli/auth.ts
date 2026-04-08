import { createServer } from 'http';

export interface GuestSession {
  guestId: string;
  displayName: string;
  accessToken: string;
}

export interface UserSession {
  userId: string;
  displayName: string;
  accessToken: string;
  isGuest: boolean;
}

export async function createGuestSession(
  serverUrl: string,
  timeoutMs = 5_000,
  fetchImpl: typeof fetch = fetch,
): Promise<GuestSession> {
  const res = await fetchImpl(`${serverUrl}/auth/guest`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Guest login failed with status ${res.status}`);
  }

  return res.json() as Promise<GuestSession>;
}

export async function fetchCurrentUser(
  serverUrl: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Omit<UserSession, 'accessToken'>> {
  const res = await fetchImpl(`${serverUrl}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(5_000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch profile with status ${res.status}`);
  }

  return res.json() as Promise<Omit<UserSession, 'accessToken'>>;
}

async function waitForGoogleToken(
  serverUrl: string,
  timeoutMs: number,
  onLoginUrl?: (url: string) => void,
): Promise<string> {
  let settled = false;

  return new Promise<string>((resolve, reject) => {
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close(() => fn());
    };

    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const token = url.searchParams.get('token');

      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      if (token) {
        res.statusCode = 200;
        res.end('<html><body><h1>Login successful</h1><p>You can return to the terminal.</p></body></html>');
        finish(() => resolve(token));
        return;
      }

      res.statusCode = 400;
      res.end('<html><body><h1>Login failed</h1><p>No token was provided.</p></body></html>');
    });

    const timer = setTimeout(() => {
      finish(() => reject(new Error(`Google login timed out after ${timeoutMs}ms`)));
    }, timeoutMs);

    server.on('error', (error) => {
      finish(() => reject(error));
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        finish(() => reject(new Error('Failed to start local OAuth callback server')));
        return;
      }

      const redirectUrl = `http://127.0.0.1:${address.port}/`;
      const loginUrl = new URL(`${serverUrl}/auth/google`);
      loginUrl.searchParams.set('redirect', redirectUrl);
      onLoginUrl?.(loginUrl.toString());
    });
  });
}

export async function createGoogleSession(
  serverUrl: string,
  timeoutMs = 120_000,
  fetchImpl: typeof fetch = fetch,
  onLoginUrl?: (url: string) => void,
): Promise<UserSession> {
  const accessToken = await waitForGoogleToken(serverUrl, timeoutMs, onLoginUrl);
  const profile = await fetchCurrentUser(serverUrl, accessToken, fetchImpl);
  return {
    accessToken,
    ...profile,
  };
}
