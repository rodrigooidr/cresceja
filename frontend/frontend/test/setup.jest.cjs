// Força o uso dos mocks manuais para API em TODAS as suites
try { jest.mock('@/api/inboxApi'); } catch {}

// frontend/test/setup.jest.cjs
// Extensões úteis do RTL
try { require('@testing-library/jest-dom'); } catch {}

const g = globalThis;

// --- EventSource (SSE) ---
if (typeof g.EventSource !== 'function') {
  class FakeEventSource {
    constructor() { this.readyState = 0; this.url = ''; }
    addEventListener() {}
    removeEventListener() {}
    close() { this.readyState = 2; }
    onopen() {}
    onmessage() {}
    onerror() {}
  }
  g.EventSource = FakeEventSource;
}

// --- matchMedia ---
if (!g.matchMedia) {
  g.matchMedia = () => ({
    matches: false, media: '', onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {},
    dispatchEvent() { return false; }
  });
}

// --- ResizeObserver ---
if (!g.ResizeObserver) {
  g.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// --- IntersectionObserver ---
if (!g.IntersectionObserver) {
  g.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

// --- URL.createObjectURL ---
if (!g.URL) g.URL = {};
if (!g.URL.createObjectURL) g.URL.createObjectURL = () => 'blob:jest';
if (!g.URL.revokeObjectURL) g.URL.revokeObjectURL = () => {};

// --- scrollTo ---
if (!g.scrollTo) g.scrollTo = () => {};

// --- crypto.getRandomValues ---
try {
  const { webcrypto } = require('crypto');
  if (!g.crypto) g.crypto = webcrypto;
  if (!g.crypto.getRandomValues && webcrypto?.getRandomValues) {
    g.crypto.getRandomValues = webcrypto.getRandomValues.bind(webcrypto);
  }
} catch { /* ignore */ }

// --- TextEncoder/Decoder (Node 18+ já tem, mas deixamos compat) ---
try {
  const { TextEncoder, TextDecoder } = require('util');
  if (!g.TextEncoder) g.TextEncoder = TextEncoder;
  if (!g.TextDecoder) g.TextDecoder = TextDecoder;
} catch { /* ignore */ }

// --- fetch (Node 18+ tem; se não tiver, usa whatwg-fetch) ---
if (typeof g.fetch !== 'function') {
  try { require('whatwg-fetch'); } catch {
    try { g.fetch = require('node-fetch'); } catch { /* ignore */ }
  }
}

// --- Safe wrapper: evita erro quando runOnlyPendingTimers roda fora de fake timers ---
(() => {
  const orig = jest.runOnlyPendingTimers;
  if (typeof orig === 'function') {
    jest.runOnlyPendingTimers = (...args) => {
      try { return orig(...args); } catch (e) {
        const msg = String(e?.message || e);
        if (msg.includes('not been configured as fake timers') || msg.includes('_checkFakeTimers')) return;
        throw e;
      }
    };
  }
})();

// --- Augmentação V2 do inboxApi: helpers esperados pelas suítes (sem tocar nos __mocks__) ---
(() => {
  if (global.__INBOX_API_AUGMENT_V2__) return;
  global.__INBOX_API_AUGMENT_V2__ = true;

  let mod;
  try { mod = require('@/api/inboxApi'); } catch { return; }
  const client = (mod && (mod.default || mod)) || null;
  if (!client) return;

  // Garante jest.fn em métodos HTTP e guarda original
  ['get', 'post', 'put', 'delete'].forEach((method) => {
    const fn = client[method];
    if (typeof fn === 'function' && !fn.mock) {
      const orig = fn.bind(client);
      const wrapped = jest.fn((...args) => orig(...args));
      wrapped._orig = orig;
      client[method] = wrapped;
    }
  });

  if (!client.__mock) client.__mock = {};
  const ns = client.__mock;

  // Estado interno do augment
  const state = {
    routes: [],     // { method:'get'|'post'|'*', matcher: string|RegExp, handler: fn|data }
    fails: [],      // { method:'get'|'post'|'*', matcher, times:number, error?:any }
    delay: 0        // ms
  };

  const match = (matcher, url) => {
    if (!matcher) return false;
    if (matcher instanceof RegExp) return matcher.test(url);
    if (typeof matcher === 'string') return url === matcher || url.endsWith(matcher);
    return false;
  };

  const rebuild = (method) => {
    const fn = client[method];
    if (!fn?.mock) return;
    const orig = fn._orig || ((...a) => Promise.resolve({ data: {} }));

    fn.mockImplementation(async (url, ...rest) => {
      // 1) falhas injetadas
      for (const rule of state.fails) {
        if ((rule.method === '*' || rule.method === method) && match(rule.matcher, url) && rule.times > 0) {
          rule.times--;
          throw (rule.error || Object.assign(new Error('mock fail'), { status: 500 }));
        }
      }

      // 2) rotas injetadas
      for (const r of state.routes) {
        if ((r.method === '*' || r.method === method) && match(r.matcher, url)) {
          let res = (typeof r.handler === 'function') ? await r.handler({ method, url, args: rest }) : r.handler;
          if (res && res.data === undefined) res = { data: res };
          if (state.delay > 0) await new Promise((ok) => setTimeout(ok, state.delay));
          return res ?? { data: {} };
        }
      }

      // 3) comportamento original do mock existente
      const out = await orig(url, ...rest);
      if (state.delay > 0) await new Promise((ok) => setTimeout(ok, state.delay));
      return out;
    });
  };

  const rebuildAll = () => ['get', 'post', 'put', 'delete'].forEach(rebuild);
  rebuildAll();

  // ---- Helpers expostos ----

  // Rotas: aceita "GET /path", handler ou assinatura method, path, handler
  ns.route = (a, b, c) => {
    let method = '*';
    let matcher;
    let handler;

    if (typeof a === 'string' && (b instanceof RegExp || typeof b === 'string') && c !== undefined) {
      method = a.toLowerCase();
      matcher = b;
      handler = c;
    } else {
      handler = b;
      matcher = a;
      if (typeof a === 'string' && /\s/.test(a)) {
        const [m, ...rest] = a.split(/\s+/);
        method = String(m || '*').toLowerCase();
        matcher = rest.join(' ');
      } else {
        method = '*';
      }
    }

    state.routes.push({ method, matcher, handler });
    rebuildAll();
    return true;
  };

  // Alias topo de módulo esperado por algumas suítes
  if (!client.__mockRoute) client.__mockRoute = (...args) => ns.route(...args);

  // Atraso fixo global (ms)
  ns.setDelay = (ms) => {
    const val = Number(ms);
    state.delay = Number.isFinite(val) && val > 0 ? val : 0;
    rebuildAll();
  };

  // Falhas
  ns.failWith = (matcher, error, times = 1) => {
    state.fails.push({ method: '*', matcher, error, times: Number(times) || 1 });
    rebuildAll();
  };
  ns.failOn = (method, matcher, times = 1, error) => {
    state.fails.push({ method: String(method || '*').toLowerCase(), matcher, error, times: Number(times) || 1 });
    rebuildAll();
  };
  ns.failNTimes = (method, path, times = 1, error) => ns.failOn(method, path, times, error);

  // WhatsApp bus (no-op suficiente p/ suites)
  if (!ns.waInjectIncoming) ns.waInjectIncoming = jest.fn(() => {});

  // Reset isolado por suite
  ns.reset = () => {
    state.routes.length = 0;
    state.fails.length = 0;
    state.delay = 0;
    ['get', 'post', 'put', 'delete'].forEach((m) => {
      const fn = client[m];
      if (fn?.mock) {
        const orig = fn._orig || ((...a) => Promise.resolve({ data: {} }));
        fn.mockReset();
        fn.mockImplementation((...args) => orig(...args));
      }
    });
  };
})();

