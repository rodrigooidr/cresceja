// frontend/src/test/setupTests.ts
import '@testing-library/jest-dom';

/* =========================
 * Polyfills / DOM shims
 * ========================= */
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
if (!('createObjectURL' in URL)) {
  // @ts-ignore
  URL.createObjectURL = jest.fn(() => 'blob://mock');
}
if (!('revokeObjectURL' in URL)) {
  // @ts-ignore
  URL.revokeObjectURL = jest.fn();
}
if (!('scrollTo' in window)) {
  // @ts-ignore
  window.scrollTo = jest.fn();
}
if (!('requestAnimationFrame' in window)) {
  // @ts-ignore
  window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
}
if (!('cancelAnimationFrame' in window)) {
  // @ts-ignore
  window.cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as NodeJS.Timeout);
}
if (!('IntersectionObserver' in global)) {
  // @ts-ignore
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}
if (!('ResizeObserver' in global)) {
  // @ts-ignore
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!('MutationObserver' in global)) {
  // @ts-ignore
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}
if (!window.matchMedia) {
  // @ts-ignore
  window.matchMedia = (query: string) => {
    const mql = {
      matches: false,
      media: query,
      onchange: null as any,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: () => false,
    };
    return mql;
  };
}
if (!global.fetch) {
  // @ts-ignore
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
}
if (!global.crypto?.getRandomValues) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto');
  // @ts-ignore
  global.crypto = { getRandomValues: (arr: Uint8Array) => nodeCrypto.randomFillSync(arr) };
}
// TextEncoder/TextDecoder para libs que precisam (ex.: socket/ws)
if (!('TextEncoder' in global) || !('TextDecoder' in global)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextEncoder, TextDecoder } = require('util');
  // @ts-ignore
  global.TextEncoder = TextEncoder;
  // @ts-ignore
  global.TextDecoder = TextDecoder;
}
// structuredClone em versões antigas do jsdom/node
if (!(global as any).structuredClone) {
  (global as any).structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

// utilidades de layout usadas por virtualização e medições
if (!Element.prototype.scrollIntoView) {
  // @ts-ignore
  Element.prototype.scrollIntoView = jest.fn();
}
if (!Element.prototype.getBoundingClientRect) {
  // @ts-ignore
  Element.prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100,
    toJSON() { return this; }
  });
}
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return 24; }});
Object.defineProperty(HTMLElement.prototype, 'offsetWidth',  { configurable: true, get() { return 200; }});
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return 24; }});

/* =========================
 * Shims/Mocks específicos do app
 * ========================= */

// Portal shim (evita precisar de DOM real para portais)
jest.mock('ui/PopoverPortal', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ open, children }: any) =>
      open ? React.createElement('div', { 'data-testid': 'popover-portal' }, children) : null,
  };
});

/* ---- socket.io-client stub ----
 * Mantém a mesma shape usada pelo app:
 *  - export default e export { io }
 *  - métodos on/off/emit/close
 */
jest.mock('socket.io-client', () => {
  const handlers: Record<string, Function> = {};
  const sock = {
    __handlers: handlers,
    on: (evt: string, cb: Function) => { handlers[evt] = cb; return sock; },
    off: (evt: string) => { delete handlers[evt]; return sock; },
    emit: (_evt: string, _payload?: any) => sock,
    connect: () => sock,
    close: () => sock,
    disconnect: () => sock,
    io: { opts: {} },
  };
  // helper para disparar eventos nos testes
  // @ts-ignore
  global.__SOCKET_PUSH__ = (evt: string, payload?: any) => { if (handlers[evt]) handlers[evt](payload); };
  return { __esModule: true, io: () => sock, default: () => sock };
});

// inboxApi mock – cobre /inbox/* e /conversations/* e outros usados nos testes
jest.mock('api/inboxApi', () => {
  const now = '2024-01-01T12:00:00Z';
  const make = (over: any = {}) => ({ data: { items: [], ...over } });

  const makeConvos = () => ({
    data: {
        items: [
          { id: '1', name: 'Alice', contact_name: 'Alice', last_message_at: now, updated_at: now, status: 'open' },
          { id: '2', name: 'Bob',   contact_name: 'Bob',   last_message_at: now, updated_at: now, status: 'open' },
        ],
      total: 2,
    },
  });

  const makeMsgs = (id: string) => ({
    data: {
      items: [
        { id: 'm1', conversation_id: id, text: 'hi',    direction: 'in',  sender: 'contact', created_at: now },
        { id: 'm2', conversation_id: id, text: 'reply', direction: 'out', sender: 'agent',   created_at: now, status: 'sent' },
      ],
      total: 2,
    },
  });

  const api = {
    get: jest.fn(async (url: string) => {
      // Conversas (ambas as famílias)
      if (/\/inbox\/conversations(\?.*)?$/.test(url) || /\/conversations(\?.*)?$/.test(url)) return makeConvos();

      // Mensagens por conversa (ambas as famílias)
      const m1 = url.match(/\/inbox\/conversations\/([^/]+)\/messages/);
      const m2 = url.match(/\/conversations\/([^/]+)\/messages/);
      if (m1 || m2) return makeMsgs((m1 || m2)![1]);

      // Templates / quick replies
      if (url.includes('/inbox/templates'))      return { data: [{ id: 't1', title: 'Boas-vindas', text: 'Bem-vindo(a)!' }] };
      if (url.includes('/inbox/quick') || url.includes('/quick-repl')) {
        return { data: [{ id: 'q1', title: 'Olá!', content: 'Olá, como posso ajudar?' }] };
      }

      // Channels summary
      if (url.includes('/channels/summary')) {
        return { data: {
          whatsapp_official: { status: 'disconnected' },
          whatsapp_baileys:  { status: 'disconnected' },
          instagram:         { status: 'disconnected' },
          facebook:          { status: 'disconnected' },
          google_calendar:   { status: 'disconnected' },
        }};
      }

      // Integrations checkers
      if (url.includes('/integrations/whatsapp/session/status')) return { data: { status: 'disconnected' } };
      if (url.includes('/integrations/whatsapp/cloud/status'))   return { data: { phone_number_id: '123', webhook_ok: true } };
      if (url.includes('/integrations/google/calendar/status'))  return { data: { connected: false } };

      return make();
    }),

    post: jest.fn(async (url: string, body?: any) => {
      if (url.includes('/inbox/messages')) {
        return { data: { id: 'mX', conversation_id: body?.conversationId ?? '1', text: body?.message ?? '', sender: 'agent', direction: 'out', created_at: now, status: 'sent' } };
      }
      if (/\/conversations\/([^/]+)\/messages/.test(url)) {
        const id = url.match(/\/conversations\/([^/]+)\/messages/)![1];
        return { data: { id: 'mX', conversation_id: id, text: body?.text ?? body?.message ?? '', sender: 'agent', direction: 'out', created_at: now, status: 'sent' } };
      }
      return make();
    }),

    put:     jest.fn(async () => make()),
    delete:  jest.fn(async () => make()),
    request: jest.fn(async () => make()),

    // axios compat
    interceptors: { request: { use: jest.fn(), eject: jest.fn() }, response: { use: jest.fn(), eject: jest.fn() } },
    defaults: { headers: { common: {} as any } },
    create: jest.fn(() => api),
  };

  const helpers = {
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
    getAuthToken: jest.fn(() => 'test-token'),
    setActiveOrg: jest.fn(),
    getImpersonateOrgId: jest.fn(() => ''),
    setImpersonateOrgId: jest.fn(),
    API_BASE_URL: 'http://localhost:4000/api',
    apiUrl: 'http://localhost:4000/api',
  };

  return { __esModule: true, default: api, ...helpers };
});

// AuthContext mock (evita logout null)
jest.mock('../contexts/AuthContext', () => {
  const React = require('react');
  const ctx = {
    user:   { id:'u1', role:'OrgAdmin', org_id:'00000000-0000-0000-0000-000000000001', name:'Test User' },
    login:  jest.fn(),
    logout: jest.fn(),
    loading:false,
  };
  return {
    __esModule: true,
    AuthContext: React.createContext(ctx),
    AuthProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useAuth: () => ctx,
  };
});

// OrgContext mock
jest.mock('../contexts/OrgContext', () => {
  const React = require('react');
  const ctx = {
    orgs: [{ id:'00000000-0000-0000-0000-000000000001', name:'Default Org' }],
    loading: false,
    selected: '00000000-0000-0000-0000-000000000001',
    setSelected: jest.fn(),
    canSeeSelector: true,
    orgChangeTick: 0,
    searchOrgs: jest.fn(),
    loadMoreOrgs: jest.fn(),
    hasMore: false,
    q: '',
  };
  return {
    __esModule: true,
    OrgContext: React.createContext(ctx),
    OrgProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useOrg: () => ctx,
  };
});

/* =========================
 * Ambiente estável (token, org, clock)
 * ========================= */
const RealDate = Date;
beforeAll(() => {
  const store: Record<string, string> = {};
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
    writable: false,
  });

  // JWT e Org fixos para os testes
  try {
    localStorage.setItem('token', 'test.jwt.token');
    localStorage.setItem('active_org_id', '00000000-0000-0000-0000-000000000001');
  } catch {}

  const fixed = new Date('2024-01-01T12:00:00.000Z');
  // @ts-ignore
  global.Date = class extends Date {
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
