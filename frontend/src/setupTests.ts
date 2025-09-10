import '@testing-library/jest-dom';
import 'whatwg-fetch';
import React from 'react';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-ignore
(global as any).ResizeObserver = ResizeObserver;

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

// MSW vazio (bypass por padrão)
// tenta carregar "msw" só se disponível
let server: any = {
  listen: () => undefined,
  resetHandlers: () => undefined,
  close: () => undefined,
};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { setupServer } = require('msw/node');
  server = setupServer();
} catch {
  // módulo msw não disponível
}
export { server };
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

// 🔧 Deixa gates sempre liberados nos testes
jest.mock('hooks/useActiveOrgGate', () => ({
  __esModule: true,
  default: () => ({ allowed: true, reason: null }),
}));

// 🔧 Mock leve do OrgContext
jest.mock('contexts/OrgContext', () => ({
  __esModule: true,
  useOrg: () => ({ org: { id: 'test-org', name: 'Test Org' }, setOrg: jest.fn(), isLoading: false }),
  OrgProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// (Se houver dependência de Auth/Trial)
jest.mock('contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ user: { id: 'u1', role: 'SuperAdmin' }, token: 't', signOut: jest.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('contexts/TrialContext', () => ({
  __esModule: true,
  useTrial: () => ({ trialDays: 14 }),
  TrialProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// 🔧 Mock do cliente HTTP usado nas páginas
jest.mock('api/inboxApi', () => {
  const ok = (data: any) => Promise.resolve({ data });
  return {
    __esModule: true,
    default: {
      get: jest.fn((url: string) => {
        if (url.includes('/admin/plans')) {
          return ok({ plans: [], feature_defs: [], plan_features: [] });
        }
        if (url.includes('/public/plans')) {
          return ok({ items: [] });
        }
        if (url.includes('/integrations/google-calendar/status')) {
          return ok({ status: 'disconnected', config: null });
        }
        if (url.includes('/admin/orgs')) {
          return ok({ orgs: [{ id: 'org-1', name: 'CresceJá' }, { id: 'org-2', name: 'CresceJá Demo' }] });
        }
        return ok({});
      }),
      post: jest.fn(() => ok({ ok: true })),
      put: jest.fn(() => ok({ ok: true })),
      delete: jest.fn(() => ok({ ok: true })),
    },
  };
});

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
