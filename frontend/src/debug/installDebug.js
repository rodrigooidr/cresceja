// === Debug network helpers: garantem que /api/* use a mesma base e headers do axios ===
(function patchNetwork() {
  // não roda em Jest
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return;

  const BASE =
    (typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL) ||
    (typeof window !== 'undefined' && window.__API_BASE_URL__) ||
    '/api';

  function getToken() {
    try {
      return localStorage.getItem('token') || '';
    } catch {
      return '';
    }
  }
  function getOrg() {
    try {
      return localStorage.getItem('activeOrgId') || '';
    } catch {
      return '';
    }
  }

  function isApi(u) {
    return typeof u === 'string' && (u.startsWith('/api/') || u.startsWith('/auth/'));
  }

  function rewrite(u) {
    if (!isApi(u)) return u;
    if (BASE.startsWith('http')) return new URL(u, BASE).toString();
    return u; // proxy do CRA lida em dev
  }

  // ---- fetch ----
  if (typeof window !== 'undefined' && !window.__DEBUG_FETCH_PATCHED__) {
    const orig = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      const rewritten = rewrite(url);
      if (isApi(url)) {
        const h = new Headers(init.headers || {});
        const token = getToken();
        const orgId = getOrg();
        if (token) {
          const cur = h.get('Authorization') || h.get('authorization') || '';
          if (!cur) {
            h.set('Authorization', `Bearer ${token}`);
          } else if (cur.includes(',')) {
            h.set('Authorization', cur.split(',')[0].trim());
          }
        }
        if (h.has('authorization')) h.delete('authorization');
        if (orgId && !h.has('X-Org-Id')) h.set('X-Org-Id', orgId);
        init = { ...init, headers: h };
      }
      return orig(rewritten, init);
    };
    window.__DEBUG_FETCH_PATCHED__ = true;
  }

  // ---- XMLHttpRequest (axios) ----
  if (typeof XMLHttpRequest !== 'undefined' && !XMLHttpRequest.__DEBUG_XHR_PATCHED__) {
    const oOpen = XMLHttpRequest.prototype.open;
    const oSend = XMLHttpRequest.prototype.send;
    const oSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      try {
        const key = typeof name === 'string' ? name.toLowerCase() : '';
        if (!this.__debugHeaders) this.__debugHeaders = {};
        if (key) this.__debugHeaders[key] = value;
      } catch {}
      return oSetRequestHeader.call(this, name, value);
    };
    XMLHttpRequest.prototype.open = function (m, u, a, us, pw) {
      this.__isApi = isApi(u);
      this.__debugHeaders = {};
      const ru = rewrite(u);
      return oOpen.call(this, m, ru, a, us, pw);
    };
    XMLHttpRequest.prototype.send = function (body) {
      if (this.__isApi) {
        const token = getToken();
        const orgId = getOrg();
        if (token) {
          const cur = this.__debugHeaders?.authorization || '';
          if (!cur) {
            this.setRequestHeader('Authorization', `Bearer ${token}`);
          } else if (typeof cur === 'string' && cur.includes(',')) {
            this.setRequestHeader('Authorization', cur.split(',')[0].trim());
          }
        }
        if (orgId) this.setRequestHeader('X-Org-Id', orgId);
      }
      return oSend.call(this, body);
    };
    XMLHttpRequest.__DEBUG_XHR_PATCHED__ = true;
  }

  // ---- EventSource (SSE) ----
  if (typeof window !== 'undefined' && window.EventSource && !window.EventSource.__DEBUG_ES_PATCHED__) {
    const Orig = window.EventSource;
    function withToken(url) {
      // EventSource não envia headers → passamos token e org via query em DEV
      const u = new URL(rewrite(url), window.location.origin);
      const token = getToken();
      const orgId = getOrg();
      if (token && !u.searchParams.get('access_token')) u.searchParams.set('access_token', token);
      if (orgId && !u.searchParams.get('org_id')) u.searchParams.set('org_id', orgId);
      return u.toString();
    }
    function Patched(url, cfg) {
      const final = isApi(url) ? withToken(url) : url;
      return new Orig(final, cfg);
    }
    Patched.prototype = Orig.prototype;
    window.EventSource = Patched;
    window.EventSource.__DEBUG_ES_PATCHED__ = true;
  }

  // logs enxutos
  try {
    window.__API_BASE_URL__ = BASE;
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
