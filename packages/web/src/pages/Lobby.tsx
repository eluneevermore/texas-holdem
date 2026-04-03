import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { loginAsGuest, createRoom, joinRoom } from '../lib/api';

export default function Lobby() {
  const navigate = useNavigate();
  const { token, displayName, setAuth, clearAuth } = useAuthStore();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const handleGuest = async () => {
    try {
      const { guestId, displayName, accessToken } = await loginAsGuest();
      localStorage.setItem('token', accessToken);
      setAuth(accessToken, guestId, displayName, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create guest session');
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_SERVER_URL || ''}/auth/google`;
  };

  const handleCreate = async () => {
    try {
      const { roomCode } = await createRoom();
      navigate(`/room/${roomCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room');
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    try {
      await joinRoom(joinCode.trim().toUpperCase());
      navigate(`/room/${joinCode.trim().toUpperCase()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    clearAuth();
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a', color: '#f8fafc',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'system-ui, sans-serif',
      padding: '20px',
    }}>
      <h1 style={{
        fontSize: '48px', fontWeight: 800, margin: '0 0 8px',
        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        Texas Hold'em
      </h1>
      <p style={{ color: '#64748b', margin: '0 0 40px', fontSize: '16px' }}>
        Multiplayer poker — play with friends or bots
      </p>

      {error && (
        <div style={{
          background: '#7f1d1d', color: '#fca5a5', padding: '8px 16px',
          borderRadius: '8px', marginBottom: '16px', fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {!token ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '280px' }}>
          <button onClick={handleGoogleLogin} style={{
            ...primaryBtn, background: '#4285f4',
          }}>
            Sign in with Google
          </button>
          <button onClick={handleGuest} style={primaryBtn}>
            Play as Guest
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '320px', alignItems: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>
            Signed in as <strong style={{ color: '#e5e7eb' }}>{displayName}</strong>
          </p>

          <button onClick={handleCreate} style={{ ...primaryBtn, width: '100%' }}>
            Create Room
          </button>

          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <input
              type="text"
              placeholder="Room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '8px',
                border: '1px solid #374151', background: '#1e293b',
                color: '#f3f4f6', fontSize: '16px', letterSpacing: '2px',
                textTransform: 'uppercase', textAlign: 'center',
              }}
            />
            <button onClick={handleJoin} style={{ ...primaryBtn, padding: '10px 20px' }}>
              Join
            </button>
          </div>

          <button onClick={handleLogout} style={{
            background: 'transparent', border: '1px solid #374151', color: '#94a3b8',
            padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
            marginTop: '8px',
          }}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '12px 24px',
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer',
};
