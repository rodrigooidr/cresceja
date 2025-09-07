import '@testing-library/jest-dom';

// Polyfills/dom shims
if (!('createObjectURL' in URL)) {
  // @ts-ignore
  URL.createObjectURL = jest.fn(() => 'blob://mock');
}
if (!('scrollTo' in window)) {
  // @ts-ignore
  window.scrollTo = jest.fn();
}
if (!('IntersectionObserver' in global)) {
  // @ts-ignore
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
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
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
}
if (!global.fetch) {
  // @ts-ignore
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
}
if (!global.crypto?.getRandomValues) {
  const nodeCrypto = require('crypto');
  // @ts-ignore
  global.crypto = { getRandomValues: (arr: Uint8Array) => nodeCrypto.randomFillSync(arr) };
}
// utilidades de layout usadas pela virtualização
if (!Element.prototype.scrollIntoView) {
  // @ts-ignore
  Element.prototype.scrollIntoView = jest.fn();
}
if (!Element.prototype.getBoundingClientRect) {
  // @ts-ignore
  Element.prototype.getBoundingClientRect = () => ({ x:0, y:0, top:0, left:0, bottom:100, right:100, width:100, height:100, toJSON(){return this;} });
}
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return 24; }});
Object.defineProperty(HTMLElement.prototype, 'offsetWidth',  { configurable: true, get() { return 200; }});
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return 24; }});

// Portal shim
jest.mock('ui/PopoverPortal', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ open, children }: any) => (open ? React.createElement('div', { 'data-testid': 'popover-portal' }, children) : null),
  };
});

// socket.io-client stub (cobre QR/status)
jest.mock('socket.io-client', () => {
  const handlers: Record<string, Function[]> = {};
  const sock = {
    on: (evt: string, cb: Function) => { (handlers[evt] ||= []).push(cb); return sock; },
    off: (evt: string, cb?: Function) => {
      if (!handlers[evt]) return sock;
      handlers[evt] = cb ? handlers[evt].filter(h => h !== cb) : [];
      return sock;
    },
    emit: (evt: string, payload?: any) => {
      if (evt === 'wa:session:ping') (handlers['wa:session:pong']||[]).forEach(fn => fn({ ok: true }));
    },
    connect: () => sock,
    disconnect: () => sock,
    io: { opts: {} },
  };
  // helper para simular eventos em testes (ex: QR)
  // @ts-ignore
  global.__SOCKET_PUSH__ = (evt: string, payload: any) => (handlers[evt]||[]).forEach(fn => fn(payload));
  return { __esModule: true, io: () => sock, default: () => sock };
});

// inboxApi mock – cobre as rotas mais usadas nos testes
jest.mock('api/inboxApi', () => {
  const makeResp = (over: any = {}) => ({ data: { items: [], ...over } });
  const now = '2024-01-01T12:00:00Z';

  const api = {
    get: jest.fn(async (url: string, cfg?: any) => {
      if (url.includes('/inbox/conversations')) {
        return {
          data: {
            items: [
              { id: 'c1', name: 'Alice', contact_name: 'Alice', last_message_at: now, updated_at: now, status: 'open' },
              { id: 'c2', name: 'Bob',   contact_name: 'Bob',   last_message_at: now, updated_at: now, status: 'open' },
            ],
            total: 2,
          },
        };
      }
      if (/\/inbox\/conversations\/([^/]+)\/messages/.test(url)) {
        const [, id] = url.match(/\/inbox\/conversations\/([^/]+)\/messages/) || [];
        return {
          data: {
            items: [
              { id: 'm1', conversation_id: id, text: 'Olá',        direction: 'in',  sender: 'contact', created_at: now },
              { id: 'm2', conversation_id: id, text: 'Tudo bem?',  direction: 'out', sender: 'agent',   created_at: now, status: 'sent' },
            ],
            total: 2,
          },
        };
      }
      if (url.includes('/inbox/templates')) {
        return { data: [{ id: 't1', title: 'Boas-vindas', text: 'Bem-vindo(a)!' }] };
      }
      if (url.includes('/inbox/quick-replies') || url.includes('/inbox/quick_replies')) {
        return { data: [{ id: 'q1', title: 'Olá!', content: 'Olá, como posso ajudar?' }] };
      }
      if (url.includes('/channels/summary')) {
        return { data: {
          whatsapp_official: { status: 'disconnected' },
          whatsapp_baileys:  { status: 'disconnected' },
          instagram:         { status: 'disconnected' },
          facebook:          { status: 'disconnected' },
          google_calendar:   { status: 'disconnected' },
        }};
      }
      if (url.includes('/integrations/whatsapp/session/status')) {
        return { data: { status: 'disconnected' } };
      }
      if (url.includes('/integrations/whatsapp/cloud/status')) {
        return { data: { phone_number_id: '123', webhook_ok: true } };
      }
      if (url.includes('/integrations/google/calendar/status')) {
        return { data: { connected: false } };
      }
      return makeResp();
    }),
    post: jest.fn(async (url: string, body?: any, cfg?: any) => {
      if (url.includes('/inbox/messages')) {
        return { data: { id: 'mX', conversation_id: body?.conversationId || body?.conversation_id || 'c1', text: body?.message || body?.text || '', sender: 'agent', direction: 'out', created_at: now, status: 'sent' } };
      }
      return makeResp();
    }),
    put: jest.fn(async () => makeResp()),
    delete: jest.fn(async () => makeResp()),
    request: jest.fn(async () => makeResp()),
    // axios compat
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

// Fixar Date para estabilidade
const RealDate = Date;
beforeAll(() => {
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
