import { GAME_EVENTS } from '@poker/shared';
import { useSocketStore } from '../../stores/socketStore';

export default function BuyInButton() {
  const socket = useSocketStore((s) => s.socket);

  const handleBuyIn = () => {
    socket?.emit(GAME_EVENTS.BUY_IN);
  };

  return (
    <button
      onClick={handleBuyIn}
      style={{
        padding: '10px 24px',
        backgroundColor: '#16a34a',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Buy In
    </button>
  );
}
