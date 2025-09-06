// frontend/src/test/setupTests.ts
import '@testing-library/jest-dom';

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
