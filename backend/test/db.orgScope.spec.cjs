function createMockRes() {
  const handlers = {};
  const res = {
    statusCode: 200,
    status: jest.fn(function status(code) {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(() => res),
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
      return res;
    }),
    once: jest.fn((event, handler) => {
      handlers[event] = handler;
      return res;
    }),
    _handlers: handlers,
  };
  return res;
}

function createMockReq(overrides = {}) {
  return {
    headers: {},
    get: jest.fn(() => null),
    params: {},
    ...overrides,
  };
}

describe('DB helper org scope', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('query without org scope does not inject uuid casts', async () => {
    const calls = [];
    const poolInstance = {
      query: jest.fn(async (text, params) => {
        calls.push([text, params]);
        if (/::uuid/i.test(String(text))) throw new Error('unexpected uuid cast in helper');
        return { rows: [{ '?column?': 1 }] };
      }),
      connect: jest.fn(),
      on: jest.fn(),
      end: jest.fn(),
    };

    global.__PG_POOL_FACTORY__ = () => poolInstance;

    const { query } = await import('../config/db.js');

    const res = await query('SELECT 1');
    expect(res).toEqual({ rows: [{ '?column?': 1 }] });
    expect(calls).toEqual([['SELECT 1', undefined]]);
    global.__PG_POOL_FACTORY__ = undefined;
  });

  test('pgRlsContext ignores invalid org id without uuid cast', async () => {
    const calls = [];
    const client = {
      query: jest.fn(async (text, params) => {
        calls.push([text, params]);
        if (/::uuid/i.test(String(text))) throw new Error('unexpected uuid cast in helper');
        return { rows: [{ '?column?': 1 }] };
      }),
      release: jest.fn(),
    };

    const pool = {
      connect: jest.fn(async () => client),
    };

    const als = {
      run: (_ctx, fn) => fn(),
    };

    await jest.unstable_mockModule('#db', () => ({
      __esModule: true,
      pool,
      als,
    }));

    const { pgRlsContext } = await import('../middleware/pgRlsContext.js');

    const req = createMockReq({
      user: { id: 'user-1', role: 'OrgAdmin', org_id: null },
      get: jest.fn((header) => (header.toLowerCase() === 'x-impersonate-org-id' ? 'orgs' : null)),
    });
    const res = createMockRes();
    const next = jest.fn();

    await pgRlsContext(req, res, next);

    expect(pool.connect).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  test('pgRlsContext sets org scope when org id is valid', async () => {
    const calls = [];
    const client = {
      query: jest.fn(async (text, params) => {
        calls.push([text, params]);
        if (/FROM\s+public\.org_users/i.test(String(text))) {
          return { rows: [{ ok: 1 }] };
        }
        if (/::uuid/i.test(String(text))) throw new Error('unexpected uuid cast in helper');
        return { rows: [{ '?column?': 1 }] };
      }),
      release: jest.fn(),
    };

    const pool = {
      connect: jest.fn(async () => client),
    };

    const als = {
      run: (_ctx, fn) => fn(),
    };

    await jest.unstable_mockModule('#db', () => ({
      __esModule: true,
      pool,
      als,
    }));

    const { pgRlsContext } = await import('../middleware/pgRlsContext.js');

    const orgId = '00000000-0000-4000-8000-000000000001';
    const req = createMockReq({
      user: { id: 'user-1', role: 'OrgAdmin', org_id: null },
      get: jest.fn((header) => (header.toLowerCase() === 'x-impersonate-org-id' ? orgId : null)),
      params: {},
    });
    const res = createMockRes();
    const next = jest.fn();

    await pgRlsContext(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(req.db).toBe(client);
    expect(next).toHaveBeenCalledTimes(1);

    const setConfigCalls = calls.filter(([sql]) => /set_config\('app\.org_id'/.test(String(sql)));
    expect(setConfigCalls).toHaveLength(1);
    expect(setConfigCalls[0][1]).toEqual([orgId, 'user-1', 'OrgAdmin']);
  });
});
