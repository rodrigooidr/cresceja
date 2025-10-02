import { useEffect, useRef, useState, useCallback } from 'react';

function createBeep({ volume = 1, ms = 700 }) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    g.gain.value = volume;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close?.();
    }, ms);
  } catch (_) {}
}

export function useInboxAlerts() {
  const [pending, setPending] = useState(new Map()); // conversationId -> { at, contact_name, chat_id }
  const [connected, setConnected] = useState(false);
  const soundCfg = useRef({ url: null, volume: 1 });
  const esRef = useRef(null);

  // load org sound config once
  useEffect(() => {
    fetch('/api/ai/settings')
      .then((r) => r.json())
      .then((data) => {
        const url = data?.alert_sound || null;
        let volume = 1;
        if (typeof data?.alert_volume === 'number') {
          volume = Math.max(0, Math.min(1, data.alert_volume));
        }
        soundCfg.current = { url, volume };
      })
      .catch(() => {});
  }, []);

  const playSound = useCallback(() => {
    const { url, volume } = soundCfg.current;
    if (url) {
      try {
        const a = new Audio(url);
        a.volume = volume;
        a.play();
        return;
      } catch (_) {}
    }
    createBeep({ volume });
  }, []);

  // initial load of unacked alerts
  useEffect(() => {
    fetch('/api/inbox/alerts')
      .then(async (r) => {
        if (r.status === 204) return { items: [] };
        try { return await r.json(); } catch { return { items: [] }; }
      })
      .then(({ items }) => {
        const m = new Map();
        (items || []).forEach((x) => m.set(x.conversation_id, x));
        setPending(m);
      })
      .catch(() => {});
  }, []);

  // SSE stream
  useEffect(() => {
    if (typeof EventSource !== 'function') return () => {};
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
    const url = `/api/inbox/alerts/stream?access_token=${encodeURIComponent(t || '')}`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;
    es.addEventListener('alert', (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        setPending((prev) => {
          const m = new Map(prev);
          m.set(payload.conversationId, {
            conversation_id: payload.conversationId,
            at: payload.at,
          });
          return m;
        });
        playSound();
      } catch (_) {}
    });
    es.addEventListener('ping', () => setConnected(true));
    es.onerror = () => setConnected(false);
    return () => {
      es.close();
    };
  }, [playSound]);

  const ack = useCallback(async (conversationId) => {
    await fetch(`/api/inbox/alerts/${conversationId}/ack`, { method: 'POST' }).catch(() => {});
    setPending((prev) => {
      const m = new Map(prev);
      m.delete(conversationId);
      return m;
    });
  }, []);

  return {
    connected,
    pending, // Map
    hasUrgent: pending.size > 0,
    ack,
  };
}
