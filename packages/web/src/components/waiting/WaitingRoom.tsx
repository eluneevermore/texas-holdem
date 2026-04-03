import { ROOM_EVENTS } from '@poker/shared';
import { useRoomStore } from '../../stores/roomStore';
import { useAuthStore } from '../../stores/authStore';
import { useSocketStore } from '../../stores/socketStore';
import PlayerList from './PlayerList';
import ConfigPanel from './ConfigPanel';

export default function WaitingRoom() {
  const socket = useSocketStore((s) => s.socket);
  const { roomCode, hostId, config, players } = useRoomStore();
  const userId = useAuthStore((s) => s.userId);
  const isHost = hostId === userId;

  if (!config || !roomCode) return null;

  const handleReady = () => socket?.emit(ROOM_EVENTS.READY_TOGGLE);
  const handleAddBot = () => socket?.emit(ROOM_EVENTS.ADD_BOT);
  const handleLeave = () => {
    socket?.disconnect();
    window.location.href = '/';
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a', color: '#f8fafc',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 20px', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px',
      }}>
        <h1 style={{ margin: 0, fontSize: '28px' }}>Room: {roomCode}</h1>
        <button onClick={copyCode} style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: '6px',
          color: '#94a3b8', padding: '4px 10px', cursor: 'pointer', fontSize: '13px',
        }}>
          Copy Code
        </button>
      </div>

      <p style={{ color: '#64748b', margin: '0 0 24px' }}>
        Blinds: {config.smallBlind}/{config.bigBlind} &middot; Stack: {config.initialStack}
        &middot; Buy-in: {config.buyInAllowed ? 'ON' : 'OFF'}
      </p>

      <PlayerList players={players} currentUserId={userId} />

      <div style={{
        display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <button onClick={handleReady} style={btnStyle('#3b82f6')}>
          Toggle Ready
        </button>
        {isHost && (
          <button onClick={handleAddBot} style={btnStyle('#8b5cf6')}>
            Add Bot
          </button>
        )}
        <button onClick={handleLeave} style={btnStyle('#64748b')}>
          Leave
        </button>
      </div>

      {isHost && (
        <div style={{ marginTop: '32px', width: '100%', maxWidth: '400px' }}>
          <ConfigPanel config={config} />
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '10px 20px',
  backgroundColor: bg,
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 600,
  cursor: 'pointer',
});
