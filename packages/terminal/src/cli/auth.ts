export interface GuestSession {
  guestId: string;
  displayName: string;
  accessToken: string;
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
