import '@testing-library/jest-dom';
import 'whatwg-fetch';

// 🧩 Shims adicionais
import './test-shims/broadcast-channel';
import './test-shims/intersection-observer';
import './test-shims/resize-observer';

// URL.createObjectURL (upload/preview)
if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = () => 'blob:jest-mock';
}

// scroll helpers usados por virtualização/inf. scroll
if (!window.scrollTo) window.scrollTo = () => {};
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

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

// requestAnimationFrame/ cancelAnimationFrame
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}
if (!global.cancelAnimationFrame) {
  global.cancelAnimationFrame = (id) => clearTimeout(id);
}

// 🔌 Limpeza do socket entre testes p/ evitar vazamentos
afterEach(() => {
  try {
    const { __resetSocketForTests } = require('./sockets/socket');
    if (typeof __resetSocketForTests === 'function') __resetSocketForTests();
  } catch {}
});

// Opcional: reset de mocks
afterEach(() => {
  jest.clearAllMocks();
});


// ---- Mocks de módulos ESM que quebram no CRA/Jest (CJS) ----
jest.mock('@bundled-es-modules/tough-cookie', () => ({}));
jest.mock('@bundled-es-modules/tough-cookie/index-esm.js', () => ({}));

// ---- Polyfills de browser ausentes no JSDOM ----
if (!window.IntersectionObserver) {
  class IO {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  window.IntersectionObserver = IO;
  global.IntersectionObserver = IO;
}

if (!window.ResizeObserver) {
  class RO {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = RO;
  global.ResizeObserver = RO;
}

// Algumas partes do código usam crypto.randomUUID()
// Em JSDOM pode não existir — criamos um fallback simples
if (!global.crypto) {
  global.crypto = {};
}
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () =>
    'test-' + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// Opcional: evitar erros de scrollTo em JSDOM
if (!window.scrollTo) {
  window.scrollTo = () => {};
}

// 1) Jest-DOM helpers
require('@testing-library/jest-dom');
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;
global.TransformStream = global.TransformStream || require('stream/web').TransformStream;

// 2) MSW – registra handlers globais dos canais (se presentes)
const { setupServer } = require('msw/node');
const { handlers: channelHandlers } = require('./inbox/channels.summary.msw');

// Alguns projetos têm outros handlers; se tiver, importe e espalhe no array:
const server = setupServer(
  ...(channelHandlers || [])
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Exporta se algum teste quiser customizar com server.use(...)
module.exports.server = server;

// 3) Garante que inboxApi.* tenham .mockResolvedValue/.mockRejectedValue disponíveis
//    (sem quebrar quem usa MSW). Ou seja: spy sem mudar a implementação por padrão.
const inboxApi = require('./api/inboxApi').default;

function ensureSpy(obj, key) {
  if (!obj || !obj[key]) return;
  // Se já é mock, não faz nada
  if (Object.prototype.hasOwnProperty.call(obj[key], 'mock')) return;
  try {
    // Vira um spy (chama a implementação real até o teste sobrescrever)
    jest.spyOn(obj, key);
  } catch (e) {
    // Em ambientes mais antigos, ignore
  }
}

// Spies nos métodos mais usados
ensureSpy(inboxApi, 'get');
ensureSpy(inboxApi, 'post');
ensureSpy(inboxApi, 'put');
ensureSpy(inboxApi, 'delete');

// Também garante estrutura mínima usada por alguns códigos
inboxApi.interceptors = inboxApi.interceptors || { request: { use: () => {} }, response: { use: () => {} } };
inboxApi.defaults = inboxApi.defaults || { baseURL: '' };

// 4) Pequenos utilitários globais que alguns testes esperam
// (ajusta conforme necessário; deixa neutro)
window.scrollTo = window.scrollTo || (() => {});
