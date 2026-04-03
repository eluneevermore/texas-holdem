import type { RoomPlayer } from '@poker/shared';

interface Props {
  players: RoomPlayer[];
  currentUserId: string | null;
}

export default function PlayerList({ players, currentUserId }: Props) {
  return (
    <div style={{ width: '100%', maxWidth: '500px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #374151', color: '#9ca3af' }}>
            <th style={{ textAlign: 'left', padding: '8px' }}>Seat</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Player</th>
            <th style={{ textAlign: 'right', padding: '8px' }}>Chips</th>
            <th style={{ textAlign: 'center', padding: '8px' }}>Ready</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.playerId} style={{ borderBottom: '1px solid #1f2937' }}>
              <td style={{ padding: '8px', color: '#d1d5db' }}>[{p.seatIndex + 1}]</td>
              <td style={{ padding: '8px', color: '#f3f4f6' }}>
                {p.displayName}
                {p.playerId === currentUserId && ' (you)'}
                {p.isHost && ' \u2654'}
                {p.isBot && ' [BOT]'}
              </td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24' }}>
                {p.chips}
              </td>
              <td style={{ padding: '8px', textAlign: 'center', fontSize: '18px' }}>
                {p.isReady ? '\u2713' : '\u2717'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
