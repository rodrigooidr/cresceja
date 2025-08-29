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
