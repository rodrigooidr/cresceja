// --- Polyfills leves para ambiente de teste ---
const React = require('react');

if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message, name = 'DOMException') {
      super(message);
      this.name = name;
    }
  };
}
if (!global.crypto) {
  global.crypto = {};
}
if (typeof global.crypto.randomUUID !== 'function') {
  global.crypto.randomUUID = () => `test-${Math.random().toString(36).slice(2)}`;
}
if (typeof URL.createObjectURL !== 'function') {
  global.URL.createObjectURL = () => 'blob:mock';
  global.URL.revokeObjectURL = () => {};
}

// --- Mock do Router (evita "Router dentro de Router") ---
// Use o Router real quando quiser (ex.: em um teste específico) setando USE_REAL_ROUTER=1
if (!process.env.USE_REAL_ROUTER) {
  jest.mock('react-router-dom', () => {
    const actual = jest.requireActual('react-router-dom');
    const PassThrough = ({ children }) => React.createElement(React.Fragment, null, children);
    const LinkComponent = React.forwardRef
      ? React.forwardRef(({ to, href, children, ...rest }, ref) => {
          const resolvedHref = href || (typeof to === 'string' ? to : to?.pathname || '#');
          return React.createElement('a', { href: resolvedHref, ...rest, ref }, children);
        })
      : ({ to, href, children, ...rest }) => {
          const resolvedHref = href || (typeof to === 'string' ? to : to?.pathname || '#');
          return React.createElement('a', { href: resolvedHref, ...rest }, children);
        };
    if (React.forwardRef) LinkComponent.displayName = 'MockLink';
    const noopNavigate = () => {};
    return {
      ...actual,
      BrowserRouter: PassThrough,
      MemoryRouter: PassThrough,
      HashRouter: PassThrough,
      Link: LinkComponent,
      NavLink: LinkComponent,
      useNavigate: () => noopNavigate,
      useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'test' }),
      useParams: () => ({}),
    };
  });
}

// --- Bridge do inboxApi para o mock ---
// Garante que QUALQUER import de ../src/api/inboxApi use o mock de Jest.
const createInboxApiMock = () => {
  const mod = require('../src/api/__mocks__/inboxApi.js');
  return mod && mod.__esModule ? mod : { __esModule: true, default: mod };
};

const registerInboxApiMock = (specifier) => {
  try {
    jest.mock(specifier, () => createInboxApiMock());
  } catch {}
};

[
  '../src/api/inboxApi',
  '../src/api/inboxApi.js',
  '../../src/api/inboxApi',
  '../../src/api/inboxApi.js',
  'src/api/inboxApi',
  'src/api/inboxApi.js',
  '@/api/inboxApi',
  '@/api/inboxApi.js',
].forEach(registerInboxApiMock);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const inboxApiModule = require("../src/api/inboxApi.js");
const inboxApi = inboxApiModule.default || inboxApiModule;
const { __mockMetaReset } = inboxApiModule;

beforeEach(() => {
  jest.clearAllMocks();
  // zera o estado do mock de contas Meta a cada teste
  if (typeof __mockMetaReset === "function") __mockMetaReset();
});
process.env.TZ = 'America/Sao_Paulo';
try {
  const { Settings, DateTime } = require('luxon');
  if (Settings) {
    Settings.defaultZone = 'America/Sao_Paulo';
    const fixedNow = DateTime.fromISO('2025-10-01T12:00:00-03:00', { setZone: true }).toMillis();
    Settings.now = () => fixedNow;
  }
} catch {}

require('@testing-library/jest-dom');

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { renderAct, actTick } = require('./utils/actUtils.js');
global.renderAct = renderAct;
global.actTick = actTick;

// Raiz para Portals usados por pickers/modais
beforeAll(() => {
  const div = document.createElement('div');
  div.id = 'portal-root';
  document.body.appendChild(div);
});

// Exec command e seleção básicas para libs de editor
if (!document.execCommand) document.execCommand = jest.fn();

if (!global.Range) {
  global.Range = class {
    setStart(){}
    setEnd(){}
    collapse(){}
    getClientRects(){ return []; }
    getBoundingClientRect(){ return { x:0,y:0,width:0,height:0,top:0,left:0,bottom:0,right:0 }; }
  };
}
if (!window.getSelection) {
  window.getSelection = () => ({
    removeAllRanges(){},
    addRange(){},
    getRangeAt(){ return new Range(); }
  });
}

// Canvas e fabric
require('jest-canvas-mock'); // provê getContext, toDataURL básico
jest.mock(
  'fabric',
  () => {
    class Obj { set(){} bringToFront(){} }
    class Image extends Obj { static fromURL(_url, cb){ cb(new Image()); } }
    class Textbox extends Obj {}
    class Canvas {
      constructor(){ this.width=1080; this.height=1080; }
      setWidth(w){ this.width=w; }
      setHeight(h){ this.height=h; }
      add(){} remove(){} dispose(){} requestRenderAll(){}
      toDataURL(){ return 'data:image/png;base64,AAAA'; }
      getObjects(){ return []; }
    }
    return { Canvas, Image, Textbox };
  },
  { virtual:true }
);

jest.mock('recharts', () => {
  const React = require('react');
  const createComponent = (displayName) => {
    const Component = React.forwardRef(
      ({ children, className, style, title, id, role, ...rest }, ref) => {
        const { ['aria-label']: ariaLabel } = rest;
        const safeProps = { ref, 'data-mock': displayName };
        if (className != null) safeProps.className = className;
        if (style != null) safeProps.style = style;
        if (title != null) safeProps.title = title;
        if (id != null) safeProps.id = id;
        if (role != null) safeProps.role = role;
        if (ariaLabel != null) safeProps['aria-label'] = ariaLabel;

        return React.createElement(
          'div',
          safeProps,
          typeof children === 'function' ? children({ width: 800, height: 600 }) : children,
        );
      },
    );
    Component.displayName = displayName;
    return Component;
  };

  return {
    __esModule: true,
    ResponsiveContainer: createComponent('ResponsiveContainer'),
    LineChart: createComponent('LineChart'),
    Line: createComponent('Line'),
    CartesianGrid: createComponent('CartesianGrid'),
    XAxis: createComponent('XAxis'),
    YAxis: createComponent('YAxis'),
    Tooltip: createComponent('Tooltip'),
    Legend: createComponent('Legend'),
    BarChart: createComponent('BarChart'),
    Bar: createComponent('Bar'),
  };
}, { virtual: true });

jest.mock('../src/api');
jest.mock('../src/ui/feature/FeatureGate.jsx', () => ({ __esModule: true, default: ({children}) => children }));
jest.mock('../src/ui/feature/FeatureGate', () => ({ __esModule: true, default: ({children}) => children }));

jest.mock('../src/contexts/AuthContext', () => {
  const React = require('react');
  const AuthContext = React.createContext({
    user: { id: 'u_test', role: 'SuperAdmin', email: 'test@x.com' },
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
    loading: false,
  });
  const useAuth = () => React.useContext(AuthContext);
  return { __esModule: true, AuthContext, useAuth };
});

// Mock do contexto de organizações para os testes

// Toasts
jest.mock(
  'react-hot-toast',
  () => ({
    __esModule: true,
    default: { success: jest.fn(), error: jest.fn() },
    toast: { success: jest.fn(), error: jest.fn() },
  }),
  { virtual: true },
);

if (!window.toast) { window.toast = jest.fn(); }

const api = inboxApi;
global.setFeatureGate = (features = {}, limits = {}) => {
  if (api.__setFeatures) api.__setFeatures(features);
  if (api.__setLimits) api.__setLimits(limits);
};
// URL helpers
if (!global.URL.createObjectURL) global.URL.createObjectURL = jest.fn(() => 'blob:mock');
if (!HTMLCanvasElement.prototype.toBlob) {
  HTMLCanvasElement.prototype.toBlob = function(cb){ cb(new Blob()); };
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = function(){};
}

// Timers: manter consistência para polling
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Estado default de org para testes (pode ajustar conforme seu domínio)
globalThis.__TEST_ORG__ = {
  id: "1",
  name: "Org Test",
  features: { calendar: true, facebook: true, instagram: true, whatsapp: true },
  plan: {
    limits: {
      calendar: 1,
      facebook_pages: 1,
      instagram_accounts: 1,
      wa_numbers: 1,
    },
  },
  channels: {
    facebook: { connected: false, pages: [], permissions: [] },
    instagram: { connected: false, accounts: [], permissions: [] },
    calendar: { connected: false, calendars: [], scopes: [] },
    whatsapp: { connected: false },
  },
};

// Helpers para os testes ajustarem feature/limit rapidamente
global.setTestOrg = (partial = {}) => {
  globalThis.__TEST_ORG__ = { ...globalThis.__TEST_ORG__, ...partial };
};
global.setFeatureGate = (features = {}, limits = {}) => {
  const curr = globalThis.__TEST_ORG__;
  globalThis.__TEST_ORG__ = {
    ...curr,
    features: { ...(curr.features || {}), ...features },
    plan: {
      ...(curr.plan || {}),
      limits: { ...((curr.plan && curr.plan.limits) || {}), ...limits },
    },
  };
};

// ---- Reset consistente por teste ----
const { setOrgIdHeaderProvider } = inboxApiModule;

beforeEach(() => {
  // Limpando provider e storage para não vazar entre testes
  try { setOrgIdHeaderProvider(null); } catch {}
  try { localStorage.clear(); sessionStorage.clear(); } catch {}

  // Força um org de teste compatível com os testes que esperam "1"
  globalThis.__TEST_ORG__ = {
    id: "1",
    name: "Org Test",
    features: { calendar: true, facebook: true, instagram: true, whatsapp: true },
    plan: { limits: { calendar: 1, facebook_pages: 1, instagram_accounts: 1, wa_numbers: 1 } },
    channels: {
      facebook: { connected: false, pages: [], permissions: [] },
      instagram: { connected: false, accounts: [], permissions: [] },
      calendar: { connected: false, calendars: [], scopes: [] },
      whatsapp: { connected: false },
    },
  };
});

// ---- Mocks de APIs do navegador que costumam quebrar testes ----
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((q) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: jest.fn(), // compat v15
      removeListener: jest.fn(), // compat v15
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

if (!window.ResizeObserver) {
  class RO { observe(){} unobserve(){} disconnect(){} }
  window.ResizeObserver = RO;
}

if (!window.IntersectionObserver) {
  class IO { constructor(){} observe(){} unobserve(){} disconnect(){} }
  window.IntersectionObserver = IO;
}

// rAF estável p/ componentes responsivos
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}

// Scrolling e layout
if (!window.scrollTo) window.scrollTo = jest.fn();
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = jest.fn();
}
if (!HTMLElement.prototype.getBoundingClientRect) {
  HTMLElement.prototype.getBoundingClientRect = () => ({ x:0,y:0,top:0,left:0,bottom:0,right:0,width:0,height:0 });
}

// Clipboard
if (!navigator.clipboard) {
  Object.assign(navigator, { clipboard: { writeText: jest.fn(), readText: jest.fn() } });
}

// Blob/URL
if (!URL.createObjectURL) URL.createObjectURL = jest.fn(() => "blob:mock");
if (!URL.revokeObjectURL) URL.revokeObjectURL = jest.fn();

// DataTransfer (drag & drop)
if (!window.DataTransfer) {
  class DataTransfer { constructor(){ this.dropEffect="copy"; this.effectAllowed="all"; this.files=[]; this.items=[]; this.types=[]; } }
  window.DataTransfer = DataTransfer;
}

// Crypto + encoders (para libs que usam)
if (!global.crypto) global.crypto = {};
if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = (arr) => (Array.from({ length: arr.length }, () => Math.floor(Math.random() * 256)), arr);
}
if (!global.crypto.subtle) {
  global.crypto.subtle = { digest: async () => new ArrayBuffer(0) };
}
if (!global.TextEncoder) {
  const { TextEncoder, TextDecoder } = require("util");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
if (!global.structuredClone) {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Canvas
if (!HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = () => ({
    // mínimos usados por libs
    measureText: () => ({ width: 0 }),
    fillRect: () => {}, clearRect: () => {}, drawImage: () => {},
    getImageData: () => ({ data: [] }), putImageData: () => {},
    createImageData: () => [], setTransform: () => {}, save: () => {}, restore: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {},
    stroke: () => {}, fill: () => {}, rotate: () => {}, scale: () => {}, translate: () => {},
    arc: () => {}, fillText: () => {}, strokeText: () => {},
  });
}

// MutationObserver
if (!global.MutationObserver) {
  global.MutationObserver = class { constructor(){ } observe(){} disconnect(){} takeRecords(){ return []; } };
}

// File / FileReader
if (!global.File) {
  class File extends Blob { constructor(chunks, name, opts={}) { super(chunks, opts); this.name = name; this.lastModified = Date.now(); } }
  global.File = File;
}
if (!global.FileReader) {
  global.FileReader = class {
    onload = null; onerror = null; onloadend = null;
    readAsDataURL(file) { setTimeout(() => { this.result = "data:,"; this.onload && this.onload({ target: this }); this.onloadend && this.onloadend({ target: this }); }, 0); }
    readAsText(file)    { setTimeout(() => { this.result = "";     this.onload && this.onload({ target: this }); this.onloadend && this.onloadend({ target: this }); }, 0); }
  };
}

// fetch (quando necessário por testes)
if (!global.fetch) {
  // polyfill global fetch and related classes
  require("whatwg-fetch");
}

// FormData (alguns ambientes do JSDOM falham em upload)
if (typeof global.FormData === "undefined") {
  global.FormData = require("form-data");
}

// Date estável (evita flakes por “hoje/agora”)
const FIXED_NOW = new Date("2025-01-01T12:00:00Z").valueOf();
beforeEach(() => {
  jest.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
});
afterEach(() => {
  Date.now.mockRestore?.();
});

// Utilitário opcional: garantir idioma e tz
Object.defineProperty(navigator, "language", { value: "pt-BR", configurable: true });
process.env.TZ = "America/Sao_Paulo";

// Reseta rotas mockadas entre testes (sem vazar handlers)
beforeEach(() => {
  try {
    inboxApi.__resetMockApi?.();
  } catch {}
});

// idle callbacks (algumas libs usam)
if (!global.requestIdleCallback) {
  global.requestIdleCallback = (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0);
  global.cancelIdleCallback = (id) => clearTimeout(id);
}

// window.open + postMessage (para fluxos OAuth/preview antigos)
if (!window.open) {
  window.open = () => ({ close: () => {}, postMessage: () => {} });
}

// Notification / Permissions
if (!global.Notification) {
  global.Notification = { permission: "granted", requestPermission: async () => "granted" };
}
if (!navigator.permissions) {
  navigator.permissions = { query: async () => ({ state: "granted" }) };
}
if (!global.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
