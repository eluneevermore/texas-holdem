import { useGameStore } from '../../stores/gameStore';

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663',
};

const SUIT_COLORS: Record<string, string> = {
  spades: '#e5e7eb', hearts: '#ef4444', diamonds: '#3b82f6', clubs: '#22c55e',
};

export default function HandResultOverlay() {
  const gs = useGameStore((s) => s.publicState);

  if (!gs?.winners || gs.winners.length === 0) return null;

  const winnerNames = new Map(
    gs.players.map((p) => [p.playerId, p.displayName]),
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: '16px', padding: '32px',
        minWidth: '380px', color: '#f8fafc', textAlign: 'center',
      }}>
        <h2 style={{ margin: '0 0 16px', color: '#fbbf24' }}>Hand Result</h2>

        {gs.winners.map((w, i) => (
          <div key={i} style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>
              {winnerNames.get(w.playerId) ?? w.playerId} wins {w.amount.toLocaleString()} chips
            </div>
            {w.handRank && (
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>{w.handRank}</div>
            )}
          </div>
        ))}

        {gs.showdown && gs.showdown.length > 0 && (
          <div style={{ marginTop: '16px', borderTop: '1px solid #374151', paddingTop: '12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#9ca3af' }}>
              Cards Revealed
            </h3>
            {gs.showdown.filter((p) => !p.mucked).map((p) => (
              <div key={p.playerId} style={{
                display: 'flex', justifyContent: 'space-between', padding: '4px 0',
                alignItems: 'center', gap: '12px',
              }}>
                <span>{winnerNames.get(p.playerId) ?? p.playerId}</span>
                <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {p.holeCards.map((card, j) => (
                    <span key={j} style={{
                      color: SUIT_COLORS[card.suit],
                      fontWeight: 700, fontSize: '15px',
                    }}>
                      {card.rank}{SUIT_SYMBOLS[card.suit]}
                    </span>
                  ))}
                  <span style={{ color: '#94a3b8', fontSize: '13px', marginLeft: '4px' }}>
                    {p.handRank}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Chip summary */}
        <div style={{ marginTop: '16px', borderTop: '1px solid #374151', paddingTop: '12px' }}>
          {gs.players.map((p) => (
            <div key={p.playerId} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '2px 0', fontSize: '13px',
            }}>
              <span style={{ color: '#d1d5db' }}>{p.displayName}</span>
              <span style={{ color: '#fbbf24' }}>{p.chips.toLocaleString()} chips</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
