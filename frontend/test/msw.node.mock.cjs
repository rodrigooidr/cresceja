// Sobe MSW em Node e aplica o mock do socket.io-client
jest.mock('socket.io-client', () => require('./__mocks__/socket.io-client.cjs'));

const { setupServer } = require('msw/node');
const { handlers } = require('./handlers.cjs');

const server = setupServer(...handlers);

// eslint-disable-next-line no-undef
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
// eslint-disable-next-line no-undef
afterEach(() => server.resetHandlers());
// eslint-disable-next-line no-undef
afterAll(() => server.close());
