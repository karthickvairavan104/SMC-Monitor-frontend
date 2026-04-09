import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import { playAlert } from '../utils/audio';

export default function useWebSocket() {
  const clientRef = useRef(null);
  const { token, user, addSignal, closeSignal, addAutoCloseEvent,
          updateBalance, settings } = useStore();

  useEffect(() => {
    if (!token || !user) return;

    const wsUrl = (import.meta.env.VITE_API_URL || '/api')
      .replace('/api', '') + '/ws';

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,

      onConnect: () => {
        // Live signal push
        client.subscribe(`/topic/signals/${user.id}`, (msg) => {
          const sig = JSON.parse(msg.body);
          addSignal(sig);
          if (settings.soundOn) playAlert(sig.grade);
          toast.success(
            `${sig.pair} ${sig.isBull ? '▲ BUY' : '▼ SELL'} · Score ${sig.score}`,
            { icon: '🔔', duration: 6000 }
          );
        });

        // Auto-close push
        client.subscribe(`/topic/autoclose/${user.id}`, (msg) => {
          const event = JSON.parse(msg.body);
          closeSignal(event.signalId, event.outcome);
          addAutoCloseEvent(event);
          updateBalance(event.balance);

          const icon  = event.outcome === 'win' ? '✅' : event.outcome === 'partial' ? '🟡' : '❌';
          const color = event.outcome === 'win' ? '#00e8b0' : event.outcome === 'partial' ? '#ffbe00' : '#ff1e3c';
          if (settings.soundOn) playAlert(event.outcome === 'win' ? 'A' : 'C');
          toast(`${icon} ${event.pair} AUTO-CLOSE · ${event.outcome.toUpperCase()} · ${event.pnl >= 0 ? '+' : ''}$${event.pnl}`, {
            style: { background: '#080f1c', color, border: `1px solid ${color}44` },
            duration: 8000,
          });
        });
      },

      onDisconnect: () => console.log('WS disconnected'),
      onStompError: (frame) => console.error('STOMP error', frame),
    });

    client.activate();
    clientRef.current = client;

    return () => client.deactivate();
  }, [token, user?.id]);
}
