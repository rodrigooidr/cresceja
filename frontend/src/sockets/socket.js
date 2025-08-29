// Singleton robusto para socket.io-client com limpeza e reset de testes
import { io } from 'socket.io-client';

let client = null;
// Registro: evento -> Set(handlers)
const registry = new Map();

function patchClient(c) {
  // Guarda refs originais
  const _on = c.on.bind(c);
  const _off = (c.off?.bind(c)) || (c.removeListener?.bind(c));

  // on: registra no socket e no registry
  c.on = (evt, fn) => {
    _on(evt, fn);
    if (!registry.has(evt)) registry.set(evt, new Set());
    registry.get(evt).add(fn);
    return c;
    // permite encadear .on().on()
  };

  // off: remove dos dois lados
  c.off = (evt, fn) => {
    try { _off(evt, fn); } catch {}
    const set = registry.get(evt);
    if (set) set.delete(fn);
    return c;
  };

  // removeAllListeners: global ou por evento
  c.removeAllListeners = (evt) => {
    if (evt) {
      const set = registry.get(evt);
      if (set) {
        for (const fn of set) {
          try { _off(evt, fn); } catch {}
        }
        registry.delete(evt);
      }
    } else {
      for (const [e, set] of registry) {
        for (const fn of set) {
          try { _off(e, fn); } catch {}
        }
      }
      registry.clear();
    }
    return c;
  };

  return c;
}

export function makeSocket() {
  if (client) return client;

  const WS_URL =
    process.env.REACT_APP_WS_URL ||
    // heurística local: troca http(s) por ws(s)
    (typeof window !== 'undefined'
      ? window.location.origin.replace(/^http/, 'ws')
      : 'ws://localhost:4000');

  // Backoff padrão + websocket puro
  const c = io(WS_URL, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });

  client = patchClient(c);
  return client;
}

// Usado pelo setupTests para evitar “leak of event listeners”
export function __resetSocketForTests() {
  try {
    if (client) {
      client.removeAllListeners();
      try { client.close?.(); } catch {}
      try { client.disconnect?.(); } catch {}
    }
  } finally {
    client = null;
    registry.clear();
  }
}
