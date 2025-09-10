import '@testing-library/jest-dom';
import 'whatwg-fetch';

class RO { observe(){} disconnect(){} unobserve(){} }
// @ts-ignore
(global as any).ResizeObserver = RO;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  }),
});

// força axios a usar o adapter http no ambiente de testes, se necessário
try {
  // @ts-ignore
  const httpAdapter = require('axios/lib/adapters/http');
  // @ts-ignore
  require('axios').defaults.adapter = httpAdapter;
} catch {}

// Polyfills
if (!global.requestAnimationFrame) {
  // @ts-ignore
  global.requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
}
if (!window.getComputedStyle) {
  // @ts-ignore
  window.getComputedStyle = () => ({ getPropertyValue: () => '' });
}
if (!Element.prototype.closest) {
  // @ts-ignore
  Element.prototype.closest = function () { return null; };
}

if (!('TextEncoder' in global)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextEncoder, TextDecoder } = require('util');
  // @ts-ignore
  global.TextEncoder = TextEncoder;
  // @ts-ignore
  global.TextDecoder = TextDecoder;
}

if (typeof TransformStream === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TransformStream } = require('web-streams-polyfill/dist/ponyfill.js');
  // @ts-ignore
  global.TransformStream = TransformStream;
}

const { server } = require('./msw/server');

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// LocalStorage estável
beforeAll(() => {
  const store: Record<string, string> = {};
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; }
    },
  });
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('active_org_id', '00000000-0000-0000-0000-000000000001');
});

// Mock do gate
jest.mock('../hooks/useActiveOrgGate', () => ({
  __esModule: true,
  default: () => ({ loading: false, selected: '00000000-0000-0000-0000-000000000001', ready: true, error: null }),
}));

// socket.io-client mock
jest.mock('socket.io-client', () => {
  const handlers: Record<string, Function> = {};
  const sock = {
    on: (evt: string, cb: Function) => { handlers[evt] = cb; return sock; },
    off: (evt: string) => { delete handlers[evt]; return sock; },
    emit: (_evt: string, _payload?: any) => sock,
    connect: () => { handlers['connect']?.(); return sock; },
    disconnect: () => sock,
    io: { opts: {} },
  } as any;
  // helper global p/ disparar eventos nos testes se precisar
  // @ts-ignore
  global.__SOCKET_PUSH__ = (evt: string, payload: any) => { handlers[evt]?.(payload); };
  return { __esModule: true, io: () => sock, default: () => sock };
});
