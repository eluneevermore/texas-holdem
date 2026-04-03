import { useSocketStore } from '../../stores/socketStore';

export default function ConnectionBanner() {
  const status = useSocketStore((s) => s.status);

  if (status === 'connected' || status === 'disconnected') return null;

  if (status === 'reconnecting') {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        padding: '8px 16px', backgroundColor: '#f59e0b', color: '#000',
        textAlign: 'center', zIndex: 1000, fontWeight: 500,
      }}>
        Connection lost — reconnecting...
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      padding: '8px 16px', backgroundColor: '#ef4444', color: '#fff',
      textAlign: 'center', zIndex: 1000, fontWeight: 500,
      display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
    }}>
      Connection lost. Your hand has been folded.
      <button
        onClick={() => { window.location.href = '/'; }}
        style={{
          background: '#fff', color: '#ef4444', border: 'none',
          padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600,
        }}
      >
        Return to Lobby
      </button>
    </div>
  );
}
