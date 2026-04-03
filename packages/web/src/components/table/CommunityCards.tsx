import type { Card } from '@poker/shared';

interface Props {
  cards: Card[];
  pot: number;
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663',
};

const SUIT_COLORS: Record<string, string> = {
  spades: '#e5e7eb', hearts: '#ef4444', diamonds: '#3b82f6', clubs: '#22c55e',
};

export default function CommunityCards({ cards, pot }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const card = cards[i];
          return (
            <div key={i} style={{
              width: '56px', height: '80px', borderRadius: '8px',
              border: '2px solid #374151', display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: card ? '#1e293b' : '#0f172a',
              fontSize: '18px', fontWeight: 700,
            }}>
              {card ? (
                <>
                  <span style={{ color: SUIT_COLORS[card.suit] }}>{card.rank}</span>
                  <span style={{ color: SUIT_COLORS[card.suit], fontSize: '16px' }}>
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
      <div style={{
        fontSize: '18px', fontWeight: 700, color: '#fbbf24',
        background: '#1e293b', padding: '4px 16px', borderRadius: '16px',
      }}>
        Pot: {pot}
      </div>
    </div>
  );
}
