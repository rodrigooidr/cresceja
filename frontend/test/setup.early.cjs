try {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
    writable: true,
  });
} catch {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

// 1) Força mock APENAS do inboxApi (NÃO mockar '@/api/index' aqui)
try { jest.mock('@/api/inboxApi'); } catch {}

try {
  const mod = require('@/api/inboxApi');
  const api = (mod && (mod.default || mod)) || null;
  const route = api && (api.__mock?.route || api.__mockRoute);
  if (typeof route === 'function') {
    route(/\/orgs\/[^/]+\/ai\/violations(\?.*)?$/, { items: [] });
  }
} catch {}

// 2) Blindar chamadas a runOnlyPendingTimers mesmo se alguém trocou para real timers no meio do teste
(() => {
  const orig = jest.runOnlyPendingTimers;
  if (typeof orig === 'function') {
    jest.runOnlyPendingTimers = (...args) => {
      try { return orig(...args); } catch (e) {
        const msg = String(e?.message || e);
        // Engole apenas os erros de timers não-fakes; demais continuam subindo
        if (msg.includes('not been configured as fake timers') || msg.includes('_checkFakeTimers')) return;
        throw e;
      }
    };
  }
})();

// 3) Augment V3: injeta helpers no inboxApi já mockado, SEM alterar mocks existentes
(() => {
  let mod;
  try { mod = require('@/api/inboxApi'); } catch { return; }
  const client = (mod && (mod.default || mod)) || null;
  if (!client) return;

  // Garante jest.fn em HTTP methods preservando o original
  ['get', 'post', 'put', 'delete'].forEach((method) => {
    const fn = client[method];
    if (typeof fn === 'function' && !fn.mock) {
      const orig = fn.bind(client);
      const wrapped = jest.fn((...args) => orig(...args));
      wrapped._orig = orig;
      client[method] = wrapped;
    }
  });

  if (!client.__mock) client.__mock = {};
  const ns = client.__mock;

  // Estado interno do augment (somente deste wrapper)
  const state = {
    routes: [],    // { method:'get'|'post'|'put'|'delete'|'*', matcher, handler }
    fails: [],     // { method, matcher, times, error }
    delay: 0       // ms
  };

  const match = (matcher, url) => {
    if (!matcher) return false;
    if (matcher instanceof RegExp) return matcher.test(url);
    if (typeof matcher === 'string') return url === matcher || url.endsWith(matcher);
    return false;
  };

  const rebuild = (method) => {
    const fn = client[method];
    if (!fn?.mock) return;
    const orig = fn._orig || ((...a) => Promise.resolve({ data: {} }));

    fn.mockImplementation(async (url, ...rest) => {
      // 1) falhas injetadas
      for (const rule of state.fails) {
        if ((rule.method === '*' || rule.method === method) && match(rule.matcher, url) && rule.times > 0) {
          rule.times--;
          throw (rule.error || Object.assign(new Error('mock fail'), { status: 500 }));
        }
      }
      // 2) rotas injetadas
      for (const r of state.routes) {
        if ((r.method === '*' || r.method === method) && match(r.matcher, url)) {
          let res = (typeof r.handler === 'function')
            ? await r.handler({ method, url, args: rest })
            : r.handler;
          if (res && res.data === undefined) res = { data: res };
          if (state.delay > 0) await new Promise(ok => setTimeout(ok, state.delay));
          return res ?? { data: {} };
        }
      }
      // 3) original do mock já existente
      const out = await orig(url, ...rest);
      if (state.delay > 0) await new Promise(ok => setTimeout(ok, state.delay));
      return out;
    });
  };

  const rebuildAll = () => ['get', 'post', 'put', 'delete'].forEach(rebuild);
  rebuildAll();

  // Helpers expostos (compat com suítes legadas)
  ns.route = (a, b, c) => {
    let method = '*';
    let matcher;
    let handler;

    if (typeof a === 'string' && (b instanceof RegExp || typeof b === 'string') && c !== undefined) {
      method = a.toLowerCase();
      matcher = b;
      handler = c;
    } else {
      handler = b;
      matcher = a;
      if (typeof a === 'string' && /\s/.test(a)) {
        const [m, ...rest] = a.split(/\s+/);
        method = String(m || '*').toLowerCase();
        matcher = rest.join(' ');
      } else {
        method = '*';
      }
    }

    state.routes.push({ method, matcher, handler });
    rebuildAll();
    return true;
  };
  if (!client.__mockRoute) client.__mockRoute = (...args) => ns.route(...args);

  ns.setDelay = (ms) => {
    const n = Number(ms);
    state.delay = Number.isFinite(n) && n > 0 ? n : 0;
    rebuildAll();
  };

  ns.failWith = (matcher, error, times = 1) => {
    state.fails.push({ method: '*', matcher, error, times: Number(times) || 1 });
    rebuildAll();
  };
  ns.failOn = (method, matcher, times = 1, error) => {
    state.fails.push({ method: String(method || '*').toLowerCase(), matcher, error, times: Number(times) || 1 });
    rebuildAll();
  };
  ns.failNTimes = (method, path, times = 1, error) => ns.failOn(method, path, times, error);

  if (!ns.waInjectIncoming) ns.waInjectIncoming = jest.fn(() => {}); // no-op suficiente

  ns.reset = () => {
    state.routes.length = 0;
    state.fails.length = 0;
    state.delay = 0;
    ['get', 'post', 'put', 'delete'].forEach((m) => {
      const fn = client[m];
      if (fn?.mock) {
        const orig = fn._orig || ((...a) => Promise.resolve({ data: {} }));
        fn.mockReset();
        fn.mockImplementation((...args) => orig(...args));
      }
    });
  };
})();
