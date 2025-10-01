// === Debug network helpers: garantem que /api/* use a mesma base e headers do axios ===
(function patchNetwork() {
  // não executa em testes (Jest)
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    // Descobre a BASE
    const ENV_BASE =
      (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE_URL) ||
      (typeof window !== 'undefined' && window.__API_BASE_URL__) ||
      '/api';

    function resolveApiUrl(u) {
      if (typeof u !== 'string') return u;
      if (!u.startsWith('/api/')) return u;
      // base absoluta? usa como origin; senão mantém relativo
      if (ENV_BASE.startsWith('http')) return new URL(u, ENV_BASE).toString();
      return u; // proxy/mesmo host
    }

    function authHeaders(init) {
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
      const orgId = (typeof localStorage !== 'undefined' && localStorage.getItem('activeOrgId')) || '';
      const headers = new Headers(init && init.headers ? init.headers : undefined);
      if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      if (orgId && !headers.has('X-Org-Id')) headers.set('X-Org-Id', orgId);
      return headers;
    }

    // ---- Patch fetch ----
    if (typeof window !== 'undefined' && !window.__DEBUG_FETCH_PATCHED__) {
      const origFetch = window.fetch.bind(window);
      window.fetch = (input, init = {}) => {
        try {
          const url = typeof input === 'string' ? input : input?.url || '';
          const rewritten = resolveApiUrl(url);
          if (url.startsWith('/api/')) {
            init = { ...init, headers: authHeaders(init) };
          }
          return origFetch(rewritten, init);
        } catch (e) { return origFetch(input, init); }
      };
      window.__DEBUG_FETCH_PATCHED__ = true;
    }

    // ---- Patch XMLHttpRequest (axios usa XHR) ----
    if (typeof XMLHttpRequest !== 'undefined' && !XMLHttpRequest.__DEBUG_XHR_PATCHED__) {
      const origOpen = XMLHttpRequest.prototype.open;
      const origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        try {
          this.__isApi = typeof url === 'string' && url.startsWith('/api/');
          const rewritten = resolveApiUrl(url);
          return origOpen.call(this, method, rewritten, async, user, password);
        } catch (e) {
          return origOpen.call(this, method, url, async, user, password);
        }
      };
      XMLHttpRequest.prototype.send = function(body) {
        try {
          if (this.__isApi) {
            const token = localStorage.getItem('token');
            const orgId = localStorage.getItem('activeOrgId');
            if (token) this.setRequestHeader('Authorization', `Bearer ${token}`);
            if (orgId) this.setRequestHeader('X-Org-Id', orgId);
          }
        } catch {}
        return origSend.call(this, body);
      };
      XMLHttpRequest.__DEBUG_XHR_PATCHED__ = true;
    }

    // ---- Patch EventSource (SSE) ----
    if (typeof window !== 'undefined' && window.EventSource && !window.EventSource.__DEBUG_ES_PATCHED__) {
      const OrigES = window.EventSource;
      function PatchedES(url, config) {
        try {
          const finalUrl = resolveApiUrl(url);
          return new OrigES(finalUrl, config);
        } catch { return new OrigES(url, config); }
      }
      // copia props estáticos
      for (const k in OrigES) { try { PatchedES[k] = OrigES[k]; } catch {} }
      PatchedES.prototype = OrigES.prototype;
      window.EventSource = PatchedES;
      window.EventSource.__DEBUG_ES_PATCHED__ = true;
    }

    // Expor a BASE para inspeção
    try { window.__API_BASE_URL__ = ENV_BASE; } catch {}
  } catch (e) {
    // silencioso
  }
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
