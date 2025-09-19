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

// --- Augmentação mínima do inboxApi: só garante jest.fn e helpers básicos em __mock ---
(function __augmentInboxApi() {
  let mod;
  try { mod = require('@/api/inboxApi'); } catch { return; }
  const client = (mod && (mod.default || mod)) || null;
  if (!client) return;

  // 1) Envolver métodos HTTP (apenas se ainda não forem jest.fn)
  ['get', 'post', 'put', 'delete'].forEach((method) => {
    const fn = client[method];
    if (typeof fn === 'function' && !fn.mock) {
      const orig = fn.bind(client);
      const wrapped = jest.fn((...args) => orig(...args));
      // marca para não reempacotar no futuro
      wrapped._isJestWrapped = true;
      client[method] = wrapped;
    }
  });

  // 2) Namespace __mock com utilitários mínimos esperados por algumas suítes
  if (!client.__mock) client.__mock = {};
  const ns = client.__mock;

  // Falhar N vezes para um endpoint específico
  if (!ns.failNTimes) {
    ns.failNTimes = (method = 'get', path = '', times = 1, error) => {
      const m = String(method).toLowerCase();
      const fn = client[m];
      if (!fn || !fn.mock) return; // não há jest.fn — algo inesperado
      const origImpl = fn.getMockImplementation() || ((...args) => Promise.resolve({ data: {} }));
      let count = 0;
      fn.mockImplementation(async (url, ...rest) => {
        if (url === path && count < times) {
          count++;
          const err = error || Object.assign(new Error('mock fail'), { status: 500 });
          throw err;
        }
        return origImpl(url, ...rest);
      });
    };
  }

  // Reset simples dos métodos jest.fn
  if (!ns.reset) {
    ns.reset = () => {
      ['get', 'post', 'put', 'delete'].forEach((m) => {
        if (client[m]?.mockReset) client[m].mockReset();
      });
    };
  }
})();

