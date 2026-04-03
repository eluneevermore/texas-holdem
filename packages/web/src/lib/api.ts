const BASE_URL = import.meta.env.VITE_SERVER_URL || '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function loginAsGuest() {
  return request<{ guestId: string; displayName: string; accessToken: string }>('/auth/guest', {
    method: 'POST',
  });
}

export async function createRoom() {
  return request<{ roomId: string; roomCode: string }>('/rooms', { method: 'POST' });
}

export async function getRoomInfo(roomCode: string) {
  return request<{ roomCode: string; state: string; playerCount: number; maxPlayers: number }>(
    `/rooms/${roomCode}`,
  );
}

export async function joinRoom(roomCode: string) {
  return request<{ roomId: string; roomCode: string }>(`/rooms/${roomCode}/join`, {
    method: 'POST',
  });
}

export async function refreshToken() {
  return request<{ accessToken: string }>('/auth/refresh', { method: 'POST' });
}
