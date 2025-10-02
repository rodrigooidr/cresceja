try {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
    writable: true,
  });
} catch {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

// 1) Força mock APENAS do inboxApi (NÃO mockar '@/api/index' aqui)
try { jest.mock('@/api/inboxApi'); } catch {}

// setup.early.cjs — sobe antes de tudo

// fetch para Node (jsdom em CI)
if (typeof global.fetch !== 'function') {
  const { fetch, Headers, Request, Response } = require('undici');
  global.fetch = fetch;
  global.Headers = Headers;
  global.Request = Request;
  global.Response = Response;
}

// TextEncoder/TextDecoder (algumas libs exigem)
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

// crypto.getRandomValues
if (!global.crypto) {
  const crypto = require('crypto');
  const webcrypto = crypto.webcrypto || crypto;
  const getRandomValues = (arr) => {
    if (webcrypto.getRandomValues) return webcrypto.getRandomValues(arr);
    return crypto.randomFillSync(arr);
  };
  const randomUUID = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (typeof webcrypto.randomUUID === 'function') return webcrypto.randomUUID();
    const buf = new Uint8Array(16);
    getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = [...buf].map((b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
  };
  global.crypto = {
    getRandomValues,
    randomUUID,
    subtle: webcrypto.subtle,
  };
}

// matchMedia
if (typeof global.matchMedia !== 'function') {
  global.matchMedia = function matchMedia() {
    return {
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  };
}

// scrollTo
if (typeof window !== 'undefined' && typeof window.scrollTo !== 'function') {
  window.scrollTo = () => {};
}

// DOMRect
if (typeof global.DOMRect !== 'function') {
  global.DOMRect = class DOMRect {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.top = y;
      this.left = x;
      this.right = x + width;
      this.bottom = y + height;
    }
    static fromRect(rect = {}) {
      return new DOMRect(rect.x, rect.y, rect.width, rect.height);
    }
  };
}

// createObjectURL / revokeObjectURL
if (typeof global.URL !== 'undefined') {
  if (typeof global.URL.createObjectURL !== 'function') {
    global.URL.createObjectURL = () => 'blob:jest-mock';
  }
  if (typeof global.URL.revokeObjectURL !== 'function') {
    global.URL.revokeObjectURL = () => {};
  }
}

// HTMLMediaElement play/pause
if (typeof global.HTMLMediaElement !== 'undefined') {
  const proto = global.HTMLMediaElement.prototype;
  if (!proto.play) proto.play = () => Promise.resolve();
  if (!proto.pause) proto.pause = () => {};
  if (!Object.getOwnPropertyDescriptor(proto, 'muted')) {
    Object.defineProperty(proto, 'muted', {
      configurable: true,
      get() { return this._muted || false; },
      set(v) { this._muted = v; },
    });
  }
}

// ResizeObserver
if (typeof global.ResizeObserver !== 'function') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// IntersectionObserver
if (typeof global.IntersectionObserver !== 'function') {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

// EventSource (mock leve para testes que apenas instanciam)
if (typeof global.EventSource !== 'function') {
  global.EventSource = class EventSource {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
    }
    close() { this.readyState = 2; }
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return false; }
  };
}

// WebSocket (evita conexões reais durante os testes)
if (typeof global.WebSocket !== 'function') {
  global.WebSocket = class WebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
    }
    close() { this.readyState = 3; }
    addEventListener() {}
    removeEventListener() {}
    send() {}
  };
}

// Silenciar logs ruidosos em CI (opcional)
const noisy = ['[HMR]', 'Download the React DevTools', 'Socket disconnected', 'SSE'];
const origError = console.error;
console.error = (...args) => {
  if (noisy.some((n) => String(args[0]).includes(n))) return;
  origError(...args);
};

// 2) Blindar chamadas a runOnlyPendingTimers mesmo se alguém trocou para real timers no meio do teste
(() => {
  const orig = jest.runOnlyPendingTimers;
  if (typeof orig === 'function') {
    jest.runOnlyPendingTimers = (...args) => {
      try {
        return orig(...args);
      } catch (e) {
        const msg = String(e?.message || e);
        // Engole apenas os erros de timers não-fakes; demais continuam subindo
        if (msg.includes('not been configured as fake timers') || msg.includes('_checkFakeTimers')) return;
        throw e;
      }
    };
  }
})();

// 3) Augment V3: injeta helpers no inboxApi já mockado, SEM alterar mocks existentes
(() => {
  let mod;
  try { mod = require('@/api/inboxApi'); } catch { return; }
  const client = (mod && (mod.default || mod)) || null;
  if (!client) return;

  // Garante jest.fn em HTTP methods preservando o original
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

  // Estado interno do augment (somente deste wrapper)
  const state = {
    routes: [], // { method:'get'|'post'|'put'|'delete'|'*', matcher, handler }
    fails: [], // { method, matcher, times, error }
    delay: 0, // ms
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
          let res = typeof r.handler === 'function'
            ? await r.handler({ method, url, args: rest })
            : r.handler;
          if (res && res.data === undefined) res = { data: res };
          if (state.delay > 0) await new Promise((ok) => setTimeout(ok, state.delay));
          return res ?? { data: {} };
        }
      }
      // 3) original do mock já existente
      const out = await orig(url, ...rest);
      if (state.delay > 0) await new Promise((ok) => setTimeout(ok, state.delay));
      return out;
    });
  };

  const rebuildAll = () => ['get', 'post', 'put', 'delete'].forEach(rebuild);
  rebuildAll();

  // Helpers expostos (compat com suítes legadas)
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
  if (!client.__mockRoute) client.__mockRoute = (...args) => ns.route(...args);

  ns.setDelay = (ms) => {
    const n = Number(ms);
    state.delay = Number.isFinite(n) && n > 0 ? n : 0;
    rebuildAll();
  };

  ns.failWith = (matcher, error, times = 1) => {
    state.fails.push({ method: '*', matcher, error, times: Number(times) || 1 });
    rebuildAll();
  };
  ns.failOn = (method, matcher, times = 1, error) => {
    state.fails.push({ method: String(method || '*').toLowerCase(), matcher, error, times: Number(times) || 1 });
    rebuildAll();
  };
  ns.failNTimes = (method, path, times = 1, error) => ns.failOn(method, path, times, error);

  if (!ns.waInjectIncoming) ns.waInjectIncoming = jest.fn(() => {}); // no-op suficiente

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

try {
  const mod = require('@/api/inboxApi');
  const api = (mod && (mod.default || mod)) || null;
  const route = api && (api.__mock?.route || api.__mockRoute);
  if (typeof route === 'function') {
    route(/\/orgs\/[^/]+\/ai\/violations(\?.*)?$/, { items: [] });
  }
} catch {}

// Flag global para toggles de compat legada em testes
global.__TEST_LEGACY_INBOX__ = true;
