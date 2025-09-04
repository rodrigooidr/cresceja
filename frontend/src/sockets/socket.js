// src/sockets/socket.js
// Singleton robusto para socket.io-client com limpeza e reset de testes
import { io } from 'socket.io-client';

let client = null;
// Registro: evento -> Set(handlers)
const registry = new Map();

function readToken() {
  return (
    localStorage.getItem('token') ||
    sessionStorage.getItem('token') ||
    ''
  );
}

function normalizeWsUrl() {
  // Url de WS do backend
  const envUrl = process.env.REACT_APP_WS_URL;
  if (envUrl) return envUrl; // ex.: http://localhost:4000

  if (typeof window !== 'undefined') {
    // tenta trocar :3000 por :4000 em dev; mantém protocolo http/https
    const origin = window.location.origin;
    if (origin.includes(':3000')) return origin.replace(':3000', ':4000');
    return origin; // em prod costuma ser o mesmo host
  }
  return 'http://localhost:4000';
}

function patchClient(c) {
  // Guarda refs originais
  const _on = c.on.bind(c);
  const _off = (c.off?.bind(c)) || (c.removeListener?.bind(c));

  // on: registra no socket e no registry
  c.on = (evt, fn) => {
    _on(evt, fn);
    if (!registry.has(evt)) registry.set(evt, new Set());
    registry.get(evt).add(fn);
    return c; // permite encadear .on().on()
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

  const WS_URL = normalizeWsUrl();
  const token = readToken();

  // IMPORTANTE: socket.io prefere http(s) em vez de ws(s)
  const c = io(WS_URL, {
    transports: ['websocket'],     // força websocket
    withCredentials: true,         // CORS credenciais
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    // handshake: backend deve ler em socket.handshake.auth.token
    auth: token ? { token: `Bearer ${token}` } : {},
  });

  // Logs úteis de diagnóstico (silencie se quiser)
  c.on('connect_error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[socket] connect_error:', err?.message || err);
  });

  // Se o token mudar (login/logout), você pode chamar refreshAuth()
  c.refreshAuth = () => {
    const t = readToken();
    c.auth = t ? { token: `Bearer ${t}` } : {};
    // se estiver desconectado, tenta conectar
    if (!c.connected && !c.connecting) {
      try { c.connect(); } catch {}
    }
  };

  client = patchClient(c);
  return client;
}

export function getSocket() {
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
