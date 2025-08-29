// 1) Jest-DOM + fetch
import '@testing-library/jest-dom';
import 'whatwg-fetch';

// 2) Polyfills centralizados
import './test-shims/broadcast-channel';     // BroadcastChannel
import './test-shims/intersection-observer'; // IntersectionObserver
import './test-shims/resize-observer';       // ResizeObserver

// URL.createObjectURL (upload/preview)
if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = () => 'blob:jest-mock';
}

// matchMedia (alguns libs consultam)
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: '',
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent() { return false; },
  });
}

// requestAnimationFrame/cancelAnimationFrame
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}
if (!global.cancelAnimationFrame) {
  global.cancelAnimationFrame = (id) => clearTimeout(id);
}

// TextEncoder/TextDecoder
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;
global.TransformStream = global.TransformStream || require('stream/web').TransformStream;

// crypto.randomUUID fallback
if (!global.crypto) global.crypto = {};
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () =>
    'test-' + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// Evitar erros de scroll em JSDOM
if (!window.scrollTo) window.scrollTo = () => {};
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// 3) MSW v1 – registra handlers globais
const { setupServer } = require('msw/node');
let channelHandlers = [];
try {
  ({ handlers: channelHandlers } = require('./inbox/channels.summary.msw'));
} catch {}
const server = setupServer(...(channelHandlers || []));

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Se algum teste quiser usar:  server.use(...)
module.exports.server = server;

// 4) Evita vazamento de socket entre testes
afterEach(() => {
  try {
    const { __resetSocketForTests } = require('./sockets/socket');
    if (typeof __resetSocketForTests === 'function') __resetSocketForTests();
  } catch {}
});

// 5) Reset de mocks entre testes
afterEach(() => {
  jest.clearAllMocks();
});

// 6) Garante que inboxApi tenha spies (sem quebrar MSW)
const inboxApi = require('./api/inboxApi').default;

function ensureSpy(obj, key) {
  if (!obj || !obj[key]) return;
  if (Object.prototype.hasOwnProperty.call(obj[key], 'mock')) return;
  try { jest.spyOn(obj, key); } catch {}
}

ensureSpy(inboxApi, 'get');
ensureSpy(inboxApi, 'post');
ensureSpy(inboxApi, 'put');
ensureSpy(inboxApi, 'delete');

inboxApi.interceptors = inboxApi.interceptors || { request: { use: () => {} }, response: { use: () => {} } };
inboxApi.defaults = inboxApi.defaults || { baseURL: '' };
