import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { useGameStore } from '../stores/gameStore';
import { connectSocket, disconnectSocket } from '../socket/connection';
import { joinRoom } from '../lib/api';
import WaitingRoom from '../components/waiting/WaitingRoom';
import GameTable from '../components/table/GameTable';
import ConnectionBanner from '../components/common/ConnectionBanner';

export default function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const roomState = useRoomStore((s) => s.state);
  const handId = useGameStore((s) => s.publicState?.handId ?? null);

  useEffect(() => {
    if (!token || !roomCode) {
      navigate('/');
      return;
    }

    let cancelled = false;

    async function join() {
      try {
        const { roomId } = await joinRoom(roomCode!);
        if (cancelled) return;
        connectSocket(token!, roomId);
      } catch {
        if (!cancelled) navigate('/');
      }
    }

    join();

    return () => {
      cancelled = true;
      disconnectSocket();
      useRoomStore.getState().clearRoom();
      useGameStore.getState().clearGame();
    };
  }, [token, roomCode, navigate]);

  if (!roomState) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a', color: '#94a3b8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}>
        Joining room...
      </div>
    );
  }

  return (
    <>
      <ConnectionBanner />
      {handId ? <GameTable /> : <WaitingRoom />}
    </>
  );
}
