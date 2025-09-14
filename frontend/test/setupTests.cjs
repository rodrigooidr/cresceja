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

jest.mock('../src/api');
jest.mock('../src/api/inboxApi.js');
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

// Navegação (padrão no-op; sobrescrever localmente quando precisar assert)
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return { ...actual, useNavigate: () => jest.fn() };
});

const api = require('../src/api/inboxApi').default || require('../src/api/inboxApi');
global.setFeatureGate = (features = {}, limits = {}) => {
  if (api.__setFeatures) api.__setFeatures(features);
  if (api.__setLimits) api.__setLimits(limits);
};

// Observers e mídia
if (!global.window.matchMedia) {
  global.window.matchMedia = () => ({
    matches: false, media: '', onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent(){ return false; },
  });
}
if (!global.ResizeObserver) {
  global.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
}
if (!global.IntersectionObserver) {
  global.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
}

// URL helpers
if (!global.URL.createObjectURL) global.URL.createObjectURL = jest.fn(() => 'blob:mock');
if (!HTMLCanvasElement.prototype.toBlob) {
  HTMLCanvasElement.prototype.toBlob = function(cb){ cb(new Blob()); };
}

// requestAnimationFrame
if (!global.requestAnimationFrame) global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
if (!global.cancelAnimationFrame) global.cancelAnimationFrame = (id) => clearTimeout(id);

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = function(){};
}

// Timers: manter consistência para polling
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});
