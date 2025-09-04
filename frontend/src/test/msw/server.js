// frontend/src/test/msw/server.js
import { setupServer } from 'msw/node';
import { makeHandlers, createInboxState } from './handlers';

// Estado compartilhado entre testes (você pode recriar/limpar por teste)
const state = createInboxState();

// Server com todos os handlers
export const server = setupServer(...makeHandlers(state));

// Exponha o estado para customização dentro do teste, se precisar
export { state };
