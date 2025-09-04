// frontend/src/test/msw/server.js
const { setupServer } = require('msw/node');
const { makeHandlers, createInboxState } = require('./handlers');

// Estado compartilhado entre testes (você pode recriar/limpar por teste)
const state = createInboxState();

// Server com todos os handlers
const server = setupServer(...makeHandlers(state));

module.exports = { server, state };
