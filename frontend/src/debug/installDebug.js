// Redireciona fetch('/api/...') para a mesma base da API
(function patchFetchBase() {
  try {
    const BASE = (typeof window !== 'undefined' && window.__API_BASE_URL__) || '/api';
    const orig = window.fetch.bind(window);
    window.fetch = (input, init) => {
      try {
        const u = typeof input === 'string' ? input : input?.url || '';
        if (u.startsWith('/api/')) {
          const full = BASE.startsWith('http') ? new URL(u, BASE).toString() : u;
          return orig(full, init);
        }
      } catch {}
      return orig(input, init);
    };
  } catch {}
})();

// Instala ganchos de log e rede no window.__debugStore
(function(){
  if (typeof window === "undefined") return;
  if (typeof process !== "undefined" && process?.env?.NODE_ENV === "production") return;

  const store = window.__debugStore = {
    logs: [],    // {ts, level, args}
    net: [],     // {ts, type:'fetch'|'xhr', method,url,status,ms,body,resp}
    max: 500
  };
  const push = (arr, obj) => { arr.push(obj); if (arr.length > store.max) arr.shift(); };

  // intercept console
  ["log","info","warn","error"].forEach(level=>{
    const orig = console[level];
    console[level] = function(...args){
      try { push(store.logs, { ts: Date.now(), level, args }); } catch {}
      return orig.apply(this, args);
    };
  });

  // erros globais
  window.addEventListener("error", (e)=>{
    push(store.logs, { ts: Date.now(), level: "error", args: [e?.message || e, e?.error?.stack || ""] });
  });
  window.addEventListener("unhandledrejection", (e)=>{
    push(store.logs, { ts: Date.now(), level: "error", args: ["UnhandledRejection", e?.reason] });
  });

  // fetch
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = async (input, init={})=>{
      const start = performance.now();
      let url = (typeof input === "string") ? input : (input && input.url);
      let method = (init && init.method) || "GET";
      try {
        const resp = await origFetch(input, init);
        const ms = Math.round(performance.now() - start);
        push(store.net, { ts: Date.now(), type: "fetch", method, url, status: resp.status, ms });
        return resp;
      } catch (err) {
        const ms = Math.round(performance.now() - start);
        push(store.net, { ts: Date.now(), type: "fetch", method, url, status: "ERR", ms, err: String(err) });
        throw err;
      }
    };
  }

  // XHR
  const XHR = window.XMLHttpRequest;
  if (XHR) {
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    XHR.prototype.open = function(method, url, ...rest){
      this.__dbg = { method, url };
      return open.apply(this, [method, url, ...rest]);
    };
    XHR.prototype.send = function(body){
      const start = performance.now();
      const onEnd = ()=>{
        const ms = Math.round(performance.now() - start);
        push(store.net, {
          ts: Date.now(), type: "xhr",
          method: this.__dbg?.method || "GET",
          url: this.__dbg?.url, status: this.status, ms
        });
        this.removeEventListener("loadend", onEnd);
      };
      this.addEventListener("loadend", onEnd);
      return send.apply(this, [body]);
    };
  }
})();

// Sockets: habilitar/desabilitar por localStorage/ENV e não travar a UI quando offline
const getSocketUrl = () => {
  const ls =
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('SOCKET_URL')
      : null;
  const fromEnv =
    (typeof process !== 'undefined' && process.env && process.env.REACT_APP_SOCKET_URL) ||
    (typeof window !== 'undefined' && window.__ENV__ && (window.__ENV__.SOCKET_URL || window.__ENV__.REACT_APP_SOCKET_URL)) ||
    null;
  return (
    ls ||
    fromEnv ||
    (typeof window !== 'undefined' && window.location ? window.location.origin : null) ||
    'http://localhost:4000'
  );
};

const socketsDisabled =
  (typeof window !== 'undefined' && window.localStorage?.getItem('DISABLE_SOCKETS') === 'true') ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_DISABLE_SOCKETS === 'true') ||
  (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.DISABLE_SOCKETS === 'true');

let io;
try {
  // eslint-disable-next-line global-require
  io = require('socket.io-client');
  io = io?.io || io?.default || io;
} catch {}

export function startSocketsSafe(options = {}) {
  if (!io || socketsDisabled) return null;
  try {
    const { url: overrideUrl, ...rest } = options || {};
    const url = overrideUrl || getSocketUrl();
    const socket = io(url, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      ...rest,
    });
    if (socket?.on) {
      socket.on('connect_error', () => {});
      socket.on('error', () => {});
    }
    return socket;
  } catch {
    return null;
  }
}

export { getSocketUrl, socketsDisabled };

// Semeia orgs/conversas quando há mock em dev:
try {
  if (
    typeof window !== 'undefined' &&
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV !== 'production' &&
    window.inboxApi && typeof window.inboxApi.__mockRoute === 'function'
  ) {
    window.inboxApi.__mockRoute('GET /orgs', {
      items: [
        { id: 'org_demo', name: 'Org Demo' },
      ],
    });
    window.inboxApi.__mockRoute('GET /orgs/org_demo/conversations', {
      items: [
        { id: 'c1', subject: 'Bem-vindo!', last: 'Olá 👋' },
      ],
    });
  }
} catch {}
