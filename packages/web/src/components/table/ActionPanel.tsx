import { useState, useEffect, useRef } from 'react';
import { GAME_EVENTS } from '@poker/shared';
import { useSocketStore } from '../../stores/socketStore';
import { useGameStore } from '../../stores/gameStore';

interface PotPreset {
  label: string;
  raiseTotal: number;
}

export default function ActionPanel() {
  const socket = useSocketStore((s) => s.socket);
  const gs = useGameStore((s) => s.publicState);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const actions = gs?.activePlayerActions ?? null;

  useEffect(() => {
    if (actions?.minRaise) setRaiseAmount(actions.minRaise);
  }, [actions?.minRaise]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  if (!gs || !actions) return null;

  const emit = (type: string, amount?: number) => {
    socket?.emit(GAME_EVENTS.ACTION, { type, amount });
  };

  const effectiveRaise = Math.max(raiseAmount, actions.minRaise);

  const potPresets: PotPreset[] = [];
  if (actions.canRaise) {
    for (const [frac, label] of [[0.25, '1/4'], [0.5, '1/2'], [1, '1/1']] as const) {
      const raiseBy = Math.floor(gs.totalPot * frac);
      const raiseTotal = gs.currentBet + raiseBy;
      if (raiseTotal >= actions.minRaise && raiseTotal <= actions.maxRaise) {
        potPresets.push({ label: `Raise ${label} pot`, raiseTotal });
      }
    }
  }

  return (
    <div style={{
      display: 'flex', gap: '8px', alignItems: 'center',
      padding: '12px', background: '#1e293b', borderRadius: '12px',
      flexWrap: 'wrap', justifyContent: 'center',
    }}>
      <button onClick={() => emit('FOLD')} style={btnStyle('#ef4444')}>
        Fold
      </button>

      {actions.canCheck ? (
        <button onClick={() => emit('CHECK')} style={btnStyle('#3b82f6')}>
          Check
        </button>
      ) : actions.canCall ? (
        <button onClick={() => emit('CALL')} style={btnStyle('#3b82f6')}>
          Call {actions.callAmount}
        </button>
      ) : null}

      {actions.canRaise && (
        <>
          <input
            type="range"
            min={actions.minRaise}
            max={actions.maxRaise}
            value={effectiveRaise}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            style={{ width: '120px', accentColor: '#16a34a' }}
          />
          <button onClick={() => emit('RAISE', effectiveRaise)} style={btnStyle('#16a34a')}>
            Raise {effectiveRaise}
          </button>

          {potPresets.length > 0 && (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                style={{
                  ...btnStyle('#16a34a'),
                  padding: '8px 10px',
                  fontSize: '16px',
                  lineHeight: 1,
                }}
                aria-label="Pot raise presets"
              >
                &#9660;
              </button>

              {menuOpen && (
                <div style={{
                  position: 'absolute', bottom: '110%', right: 0,
                  background: '#1e293b', border: '1px solid #334155',
                  borderRadius: '8px', overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  zIndex: 20, minWidth: '150px',
                }}>
                  {potPresets.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => { emit('RAISE', p.raiseTotal); setMenuOpen(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '10px 14px', background: 'transparent',
                        color: '#fff', border: 'none', fontSize: '14px',
                        fontWeight: 600, cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#16a34a'; }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <button onClick={() => emit('ALL_IN')} style={btnStyle('#dc2626')}>
        All In
      </button>
    </div>
  );
}

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '8px 16px', backgroundColor: bg, color: '#fff',
  border: 'none', borderRadius: '8px', fontSize: '14px',
  fontWeight: 600, cursor: 'pointer',
});
