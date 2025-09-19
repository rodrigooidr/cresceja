// Força o uso dos mocks manuais para API em TODAS as suites
try { jest.mock('@/api/inboxApi'); } catch {}
try { jest.mock('@/api/index'); } catch {}

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
