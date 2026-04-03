import { useGameStore } from '../../stores/gameStore';

export default function HandResultOverlay() {
  const winners = useGameStore((s) => s.winners);
  const showdownPlayers = useGameStore((s) => s.showdownPlayers);

  if (winners.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: '16px', padding: '32px',
        minWidth: '360px', color: '#f8fafc', textAlign: 'center',
      }}>
        <h2 style={{ margin: '0 0 16px', color: '#fbbf24' }}>Hand Result</h2>

        {winners.map((w, i) => (
          <div key={i} style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>
              {w.playerId} wins {w.amount} chips
            </div>
            {w.handRank && (
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>{w.handRank}</div>
            )}
          </div>
        ))}

        {showdownPlayers.length > 0 && (
          <div style={{ marginTop: '16px', borderTop: '1px solid #374151', paddingTop: '12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#9ca3af' }}>
              Cards Revealed
            </h3>
            {showdownPlayers.filter((p) => !p.mucked).map((p) => (
              <div key={p.playerId} style={{
                display: 'flex', justifyContent: 'space-between', padding: '4px 0',
              }}>
                <span>{p.playerId}</span>
                <span style={{ color: '#94a3b8' }}>
                  {p.holeCards.map((c) => `${c.rank}${c.suit[0]}`).join(' ')} — {p.handRank}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
