import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Lobby from './pages/Lobby';
import RoomPage from './pages/RoomPage';
import Profile from './pages/Profile';
import { useAuthStore } from './stores/authStore';

export default function App() {
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    // Restore token from URL (Google OAuth callback) or localStorage
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      window.history.replaceState({}, '', '/');
    }

    const stored = localStorage.getItem('token');
    if (stored) {
      try {
        const payload = JSON.parse(atob(stored.split('.')[1]));
        setAuth(stored, payload.userId, payload.displayName, payload.isGuest);
      } catch {
        localStorage.removeItem('token');
      }
    }
  }, [setAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/room/:roomCode" element={<RoomPage />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  );
}
