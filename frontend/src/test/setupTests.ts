// frontend/src/test/setupTests.ts
import '@testing-library/jest-dom';
import '@testing-library/jest-dom';
 
 // Polyfills úteis no JSDOM
 if (!('createObjectURL' in URL)) {
   // @ts-ignore
@@ -12,6 +13,48 @@ if (!('scrollTo' in window)) {
   window.scrollTo = jest.fn();
 }

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

   // Polyfills úteis no JSDOM
if (!('createObjectURL' in URL)) {
  // @ts-ignore
  URL.createObjectURL = jest.fn(() => 'blob://mock');
}
if (!('scrollTo' in window)) {
  // @ts-ignore
  window.scrollTo = jest.fn();
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
