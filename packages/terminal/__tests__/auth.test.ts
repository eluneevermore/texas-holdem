import { describe, it, expect, vi } from 'vitest';
import { createGuestSession } from '../src/cli/auth.js';

describe('createGuestSession', () => {
  it('returns the guest session payload on success', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        guestId: 'guest-1',
        displayName: 'Guest#1234',
        accessToken: 'token-1',
      }),
    } as unknown as Response);

    await expect(createGuestSession('http://localhost:3001', 5_000, fetchMock)).resolves.toEqual({
      guestId: 'guest-1',
      displayName: 'Guest#1234',
      accessToken: 'token-1',
    });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/auth/guest', {
      method: 'POST',
      signal: expect.any(AbortSignal),
    });
  });

  it('throws when the server responds with a non-OK status', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    await expect(createGuestSession('http://localhost:3001', 5_000, fetchMock)).rejects.toThrow(
      'Guest login failed with status 503',
    );
  });

  it('propagates network failures so the CLI can switch out of the loading screen', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(createGuestSession('http://localhost:3001', 5_000, fetchMock)).rejects.toThrow(
      'connect ECONNREFUSED',
    );
  });
});
