import type { Card, Pot } from '@poker/shared';

interface Props {
  cards: Card[];
  totalPot: number;
  pots: Pot[];
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663',
};

const SUIT_COLORS: Record<string, string> = {
  spades: '#e5e7eb', hearts: '#ef4444', diamonds: '#3b82f6', clubs: '#22c55e',
};

export default function CommunityCards({ cards, totalPot, pots }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
    }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const card = cards[i];
          return (
            <div key={i} style={{
              width: '52px', height: '76px', borderRadius: '8px',
              border: '2px solid #374151', display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: card ? '#1e293b' : '#0f172a',
              fontSize: '16px', fontWeight: 700,
            }}>
              {card ? (
                <>
                  <span style={{ color: SUIT_COLORS[card.suit] }}>{card.rank}</span>
                  <span style={{ color: SUIT_COLORS[card.suit], fontSize: '14px' }}>
                    {SUIT_SYMBOLS[card.suit]}
                  </span>
                </>
              ) : (
                <span style={{ color: '#374151' }}>?</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Pot display */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{
          fontSize: '16px', fontWeight: 700, color: '#fbbf24',
          background: '#1e293b', padding: '3px 14px', borderRadius: '16px',
        }}>
          Pot: {totalPot.toLocaleString()}
        </div>

        {pots.length > 1 && pots.map((pot, i) => (
          <div key={i} style={{
            fontSize: '11px', color: '#94a3b8',
            background: '#1e293b', padding: '2px 8px', borderRadius: '10px',
          }}>
            {i === 0 ? 'Main' : `Side ${i}`}: {pot.amount.toLocaleString()}
          </div>
        ))}
      </div>
    </div>
  );
}
