// frontend/src/test/setupTests.ts
import '@testing-library/jest-dom';

// ---------------- Polyfills base ----------------
// Polyfills úteis no JSDOM
if (!('createObjectURL' in URL)) {
  // @ts-ignore
  URL.createObjectURL = jest.fn(() => 'blob://mock');
}
if (!('scrollTo' in window)) {
  // @ts-ignore
  window.scrollTo = jest.fn();
}

// Alguns componentes/libraries usam scrollIntoView/GBCR
// Evita erros em testes que interagem com listas/menus
// @ts-ignore
if (!Element.prototype.scrollIntoView) {
  // @ts-ignore
  Element.prototype.scrollIntoView = jest.fn();
}
if (!Element.prototype.getBoundingClientRect) {
  // @ts-ignore
  Element.prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, width: 100, height: 20,
    top: 0, left: 0, bottom: 20, right: 100,
    toJSON: () => {}
  });
}

// ---------------- Observers (mocks) ----------------
// IntersectionObserver não existe no JSDOM
// Mock simples que satisfaz bibliotecas de virtual list / lazy load
// @ts-ignore
if (typeof (global as any).IntersectionObserver === 'undefined') {
  class MockIntersectionObserver {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(callback?: any, options?: any) {}
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
    takeRecords = jest.fn(() => []);
    root: any = null;
    rootMargin = '0px';
    thresholds = [0];
  }
  // @ts-ignore
  (global as any).IntersectionObserver = MockIntersectionObserver as any;
  // @ts-ignore
  (global as any).IntersectionObserverEntry = class {};
}

// ResizeObserver também costuma faltar
// @ts-ignore
if (typeof (global as any).ResizeObserver === 'undefined') {
  (global as any).ResizeObserver = class {
    observe = jest.fn(); unobserve = jest.fn(); disconnect = jest.fn();
  };
}

// ---------------- matchMedia / fetch / WebSocket (comuns nas telas de integrações) ----------------
// matchMedia para CSS queries e libs de UI
// @ts-ignore
if (typeof (window as any).matchMedia === 'undefined') {
  // @ts-ignore
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}
// fetch simples (evita falha caso algum trecho use fetch direto)
// @ts-ignore
if (typeof (global as any).fetch === 'undefined') {
  // @ts-ignore
  (global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
}
// WebSocket mock (algumas páginas podem tentar conectar sockets durante testes)
// @ts-ignore
if (typeof (global as any).WebSocket === 'undefined') {
  // @ts-ignore
  (global as any).WebSocket = class {
    constructor() {}
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

// Mock global do PopoverPortal (evita erro de portal/dom)
// Sem JSX e sem anotação de tipos para reduzir atritos de build
jest.mock('ui/PopoverPortal', () => ({
  __esModule: true,
  default: (props: any) => (props?.open ? props.children : null),
}));

// Mock global do inboxApi — se algum teste precisar sobrescrever,
// use mockResolvedValueOnce nele (ex.: inboxApi.get.mockResolvedValueOnce(...))
jest.mock('api/inboxApi', () => {
  const makeResp = (over: any = {}) => ({ data: { items: [], ...over } });
  const api: any = {
    get: jest.fn(async () => makeResp()),
    post: jest.fn(async () => makeResp()),
    put: jest.fn(async () => makeResp()),
    delete: jest.fn(async () => makeResp()),
    request: jest.fn(async () => makeResp()),
    // axios-like compat
    interceptors: { request: { use: jest.fn(), eject: jest.fn() }, response: { use: jest.fn(), eject: jest.fn() } },
    defaults: { headers: { common: {} as any } },
    create: jest.fn(() => api),
  };
  const helpers = {
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
    apiUrl: 'http://localhost:4000/api',
  };
  return { __esModule: true, default: api, ...helpers };
});

// Fixar Date em alguns testes (opcional, ajuda com snapshots/ordenação por data)
const RealDate = Date;
beforeAll(() => {
  const fixed = new RealDate('2024-01-01T12:00:00.000Z');
  // @ts-ignore
  global.Date = class extends RealDate {
    constructor(...args: any[]) {
      // @ts-ignore
      return args.length ? new RealDate(...args) : new RealDate(fixed);
    }
    static now() { return fixed.getTime(); }
    static UTC = RealDate.UTC;
    static parse = RealDate.parse;
  } as any;
});
afterAll(() => {
  // @ts-ignore
  global.Date = RealDate;
});
