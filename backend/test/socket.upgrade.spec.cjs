const { io: createClient } = require('socket.io-client');

let start;
let stop;
let server;
let port;
let originalNodeEnv;

describe('socket.io server', () => {
  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    process.env.RUN_WORKERS = '0';
    process.env.SKIP_DB_HEALTHCHECK = '1';
    ({ start, stop } = await import('../server.js'));
  });

  afterAll(() => {
    delete process.env.PORT;
    delete process.env.SKIP_DB_HEALTHCHECK;
    delete process.env.RUN_WORKERS;
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  beforeEach(async () => {
    server = await start({ port: 0, startWorkers: false });
    const address = server.address();
    port = typeof address === 'object' && address ? address.port : 4000;
  });

  afterEach(async () => {
    if (stop) {
      await stop();
    }
  }, 20000);

  it('returns sid on initial polling handshake without token', async () => {
    await new Promise((resolve, reject) => {
      const client = createClient(`http://127.0.0.1:${port}`, {
        transports: ['polling'],
        forceNew: true,
        reconnection: false,
      });

      const cleanup = (err) => {
        client.close();
        if (err) reject(err);
        else resolve();
      };

      client.on('connect', () => {
        try {
          expect(client.id).toBeTruthy();
          expect(client.io.engine.transport.name).toBe('polling');
          cleanup();
        } catch (err) {
          cleanup(err);
        }
      });

      client.on('connect_error', cleanup);
    });
  });

  it('upgrades connection to websocket', async () => {
    await new Promise((resolve, reject) => {
      const client = createClient(`http://127.0.0.1:${port}`, {
        transports: ['polling', 'websocket'],
        forceNew: true,
        reconnection: false,
      });

      const cleanup = (err) => {
        client.close();
        if (err) reject(err);
        else resolve();
      };

      client.io.engine.once('upgrade', (transport) => {
        try {
          expect(transport.name).toBe('websocket');
          cleanup();
        } catch (err) {
          cleanup(err);
        }
      });

      client.on('connect_error', cleanup);
    });
  });
});
