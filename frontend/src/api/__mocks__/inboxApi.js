import apiBase, {
  __mockRoute,
  __resetMockApi,
  __getLastRequest,
  __setFeatures,
  __setLimits,
  __setProgressScenario,
  searchOrgs,
  searchClients,
  getPlanFeatures,
  savePlanFeatures,
} from "./index";

const METHODS = ["get", "post", "put", "patch", "delete"];

const makeClient = (config = {}) => {
  const client = {
    __config: config,
    defaults: {
      baseURL: config.baseURL,
      headers: { ...(config.headers || {}) },
    },
    interceptors: {
      request: { use: () => {} },
      response: { use: () => {} },
    },
  };

  for (const method of METHODS) {
    client[method] = api[method];
  }

  return client;
};

// Clona a referência para manter a implementação original
const api = { ...apiBase };

// Envolva os métodos HTTP em jest.fn para suportar .mockImplementation no teste
for (const m of METHODS) {
  const orig = apiBase[m];
  api[m] = jest.fn((...args) => orig(...args));
}

const marketingJobs = [
  {
    id: "job-1",
    channel: "instagram",
    title: "Sugestão IG/FB #1",
    caption: "Legenda 1",
    status: "pending",
  },
  {
    id: "job-2",
    channel: "facebook",
    title: "Sugestão IG/FB #2",
    status: "pending",
  },
];

const originalGet = api.get;
const originalPost = api.post;

function handleGet(...args) {
  const [url] = args;
  if (typeof url === "string") {
    // WhatsApp history (cloud/baileys)
    if (url.startsWith("/whatsapp/cloud/history") || url.startsWith("/whatsapp/baileys/history")) {
      const u = new URL("http://x" + url);
      const chatId = u.searchParams.get("chatId");
      const limit = Number(u.searchParams.get("limit")) || 20;
      const cursor = u.searchParams.get("cursor");
      const store = __waChats.get(chatId) || { messages: [] };
      let start = store.messages.length - limit;
      if (cursor) {
        const idx = store.messages.findIndex((m) => m.id === cursor);
        start = Math.max(0, idx - limit);
      }
      const slice = store.messages.slice(Math.max(0, start));
      const nextCursor = slice.length ? slice[0].id : null;
      return Promise.resolve({ data: { items: slice, nextCursor } });
    }
    if (url.startsWith("/gov/logs")) {
      try {
        const parsed = new URL(url, "http://mock.local");
        const event = parsed.searchParams.get("event");
        const parsedLimit = Number(parsed.searchParams.get("limit"));
        const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;
        let items = __auditLogs;
        if (event) {
          items = items.filter((entry) => entry?.event === event);
        }
        return Promise.resolve({ data: { items: items.slice(-limit) } });
      } catch {
        return Promise.resolve({ data: { items: [] } });
      }
    }
    if (/\/marketing\/content\/jobs/.test(url) || /\/marketing\/calendar\/jobs/.test(url)) {
      return Promise.resolve({ data: { items: marketingJobs } });
    }
    if (/\/marketing\/(?:calendar|content)\/events/.test(url)) {
      const start = new Date();
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return Promise.resolve({
        data: {
          items: [
            {
              id: "evt-1",
              start: start.toISOString(),
              end: end.toISOString(),
              title: "Sugestão IG/FB #1",
              channel: "instagram",
            },
          ],
        },
      });
    }
    if (/^\/channels\/meta\/accounts\/[^/]+\/backfill\/status/.test(url)) {
      return Promise.resolve({ data: { last: null } });
    }
    if (/^\/channels\/meta\/accounts/.test(url)) {
      return Promise
        .resolve(originalGet(...args))
        .then((res) => {
          const items = Array.isArray(res?.data?.items) ? res.data.items : [];
          return { data: { items } };
        })
        .catch(() => ({ data: { items: [] } }));
    }
    if (/^\/settings\/google-calendar\/accounts/i.test(url)) {
      return Promise.resolve({ data: { items: [] } });
    }
    if (/^\/settings\/instagram\/accounts/i.test(url)) {
      return Promise.resolve({ data: { items: [] } });
    }
  }
  return originalGet(...args);
}

function handlePost(...args) {
  const [url, body] = args;
  const config = args.length > 2 ? args[2] : undefined;
  if (typeof url === "string") {
    // WhatsApp endpoints (cloud/baileys)
    if (/^\/whatsapp\/(cloud|baileys)\/send$/.test(url)) {
      const bus = api.__mock.waBus();
      const chatId = body.chatId || body.to;
      const msg = {
        id: `wam-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        chatId,
        from: "me",
        to: body.to,
        direction: "out",
        type: "text",
        text: body.text || "",
        media: null,
        timestamp: Date.now(),
        status: "sent",
      };
      const store = __waChats.get(chatId) || { messages: [] };
      store.messages.push(msg);
      __waChats.set(chatId, store);
      setTimeout(() => {
        bus.emit("wa:message", { ...msg });
      }, 0);
      setTimeout(() => {
        msg.status = "delivered";
        bus.emit("wa:status", {
          chatId,
          messageId: msg.id,
          status: "delivered",
          timestamp: Date.now(),
        });
      }, __waOpts.autoDeliverMs);
      if (__waOpts.readReceipts) {
        setTimeout(() => {
          msg.status = "read";
          bus.emit("wa:status", {
            chatId,
            messageId: msg.id,
            status: "read",
            timestamp: Date.now(),
          });
        }, __waOpts.autoReadMs);
      }
      return Promise.resolve({
        data: {
          ok: true,
          message: msg,
          idempotency: config?.headers?.["Idempotency-Key"] || null,
        },
      });
    }
    if (/^\/whatsapp\/(cloud|baileys)\/sendMedia$/.test(url)) {
      const bus = api.__mock.waBus();
      const chatId = body.chatId || body.to;
      const msg = {
        id: `wam-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        chatId,
        from: "me",
        to: body.to,
        direction: "out",
        type: body?.media?.type || "image",
        text: body?.caption || "",
        media: body.media || null,
        timestamp: Date.now(),
        status: "sent",
      };
      const store = __waChats.get(chatId) || { messages: [] };
      store.messages.push(msg);
      __waChats.set(chatId, store);
      setTimeout(() => {
        bus.emit("wa:message", { ...msg });
      }, 0);
      setTimeout(() => {
        msg.status = "delivered";
        bus.emit("wa:status", {
          chatId,
          messageId: msg.id,
          status: "delivered",
          timestamp: Date.now(),
        });
      }, __waOpts.autoDeliverMs);
      if (__waOpts.readReceipts) {
        setTimeout(() => {
          msg.status = "read";
          bus.emit("wa:status", {
            chatId,
            messageId: msg.id,
            status: "read",
            timestamp: Date.now(),
          });
        }, __waOpts.autoReadMs);
      }
      return Promise.resolve({
        data: {
          ok: true,
          message: msg,
          idempotency: config?.headers?.["Idempotency-Key"] || null,
        },
      });
    }
    if (/^\/whatsapp\/(cloud|baileys)\/markRead$/.test(url)) {
      const bus = api.__mock.waBus();
      setTimeout(() => {
        const store = __waChats.get(body.chatId);
        if (store) {
          const entry = store.messages.find((m) => m.id === body.messageId);
          if (entry) entry.status = "read";
        }
        bus.emit("wa:status", {
          chatId: body.chatId,
          messageId: body.messageId,
          status: "read",
          timestamp: Date.now(),
        });
      }, 10);
      return Promise.resolve({ data: { ok: true } });
    }
    if (/^\/whatsapp\/(cloud|baileys)\/typing$/.test(url)) {
      const bus = api.__mock.waBus();
      bus.emit("wa:typing", {
        chatId: body.chatId,
        from: "me",
        state: body.state,
        timestamp: Date.now(),
      });
      return Promise.resolve({ data: { ok: true } });
    }
    if (url === "/gov/logs") {
      const now = Date.now();
      const payload = body && typeof body === "object" ? body : {};
      const record = {
        id: `log-${now}-${Math.random().toString(36).slice(2)}`,
        ts: now,
        event: payload.event ?? null,
        actor: payload.actor ?? null,
        payload: payload.payload ?? null,
      };
      __auditLogs.push(record);
      return Promise.resolve({ data: { ok: true, id: record.id } });
    }
    if (url === "/marketing/revert") {
      const payload = body && typeof body === "object" ? body : {};
      return Promise.resolve({ data: { ok: true, reverted: true, ...payload } });
    }
    if (/\/marketing\/content\/approve/.test(url) || /\/marketing\/calendar\/approve/.test(url)) {
      return Promise.resolve({ data: { ok: true, received: body || null } });
    }
    if (/^\/marketing\/jobs\/[\w-]+\/approve$/.test(url)) {
      const payload = body && typeof body === 'object' ? body : {};
      return Promise.resolve({ data: { ok: true, kind: 'job', ...payload } });
    }
    if (/^\/marketing\/suggestions\/[\w-]+\/approve$/.test(url)) {
      const payload = body && typeof body === 'object' ? body : {};
      return Promise.resolve({ data: { ok: true, kind: 'suggestion', ...payload } });
    }
  }
  return originalPost(...args);
}

const defaultGet = handleGet;
const defaultPost = handlePost;

let getHandler = defaultGet;
let postHandler = defaultPost;
let delayMs = 0;
let failMatchers = [];
let typedFailures = [];
let flakyFailures = [];
// --- WhatsApp mock store ---
let __waBus = null;
let __waChats = new Map(); // chatId -> { messages: [{...}] }
let __waOpts = { readReceipts: true, autoDeliverMs: 40, autoReadMs: 80 };
let __auditLogs = [];

function createAbortError() {
  try {
    return new DOMException('Aborted', 'AbortError');
  } catch {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    return err;
  }
}

function withDelay(promiseFactory, config = {}) {
  const signal = config?.signal;
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }
  if (!delayMs) return promiseFactory();
  return new Promise((resolve, reject) => {
    let finished = false;
    let timer;

    function cleanup() {
      if (signal && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onAbort);
      }
    }

    function finish(exec) {
      if (finished) return;
      finished = true;
      cleanup();
      exec();
    }

    function onAbort() {
      if (timer) clearTimeout(timer);
      finish(() => reject(createAbortError()));
    }

    timer = setTimeout(() => {
      if (signal?.aborted) {
        onAbort();
        return;
      }
      Promise.resolve()
        .then(promiseFactory)
        .then((value) => finish(() => resolve(value)))
        .catch((error) => finish(() => reject(error)));
    }, delayMs);

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function matches(matcher, url) {
  if (typeof url !== 'string') return false;
  if (matcher instanceof RegExp) return matcher.test(url);
  if (typeof matcher === 'string') {
    try {
      return new RegExp(matcher).test(url);
    } catch {
      return matcher === url;
    }
  }
  return false;
}

function shouldFail(url) {
  if (typeof url !== 'string') return false;
  return failMatchers.some((matcher) => matches(matcher, url));
}

function findTypedFailure(url) {
  if (typeof url !== 'string') return undefined;
  return typedFailures.find((entry) => matches(entry.matcher, url));
}

function findFlakyFailure(url) {
  if (typeof url !== 'string') return undefined;
  return flakyFailures.find((entry) => {
    if (!matches(entry.matcher, url)) return false;
    if (typeof entry.count !== 'number') entry.count = 0;
    const total = typeof entry.times === 'number' ? entry.times : 0;
    return entry.count < total;
  });
}

function createHttpError(status = 500, message = 'Mock HTTP Error', extra = {}) {
  const err = new Error(message);
  err.name = 'HttpError';
  err.status = status;
  const response = {
    status,
    data: extra.data ?? null,
  };
  if (typeof extra.headers !== 'undefined') {
    response.headers = extra.headers;
  }
  err.response = response;
  err.isAxiosError = true;
  err.__mock = { ...(extra || {}) };
  return err;
}

function rejectHttp(status = 500, message = 'Mock HTTP Error', extra = {}) {
  return Promise.reject(createHttpError(status, message, extra));
}

api.get = jest.fn((...args) => {
  const config = args[1];
  return withDelay(() => getHandler(...args), config);
});
api.post = jest.fn((...args) => {
  const [url] = args;
  const config = args.length > 2 ? args[2] : args[1];
  return withDelay(() => {
    if (shouldFail(url)) {
      return rejectHttp(500, `forced fail: ${url}`);
    }
    const typed = findTypedFailure(url);
    if (typed) {
      return rejectHttp(typed.status ?? 500, typed.message ?? `forced fail: ${url}`, typed);
    }
    const flaky = findFlakyFailure(url);
    if (flaky) {
      flaky.count += 1;
      return rejectHttp(flaky.status ?? 503, flaky.message ?? `flaky fail: ${url}`, flaky);
    }
    if (config?.signal?.aborted) {
      return Promise.reject(createAbortError());
    }
    return postHandler(...args);
  }, config);
});

const applyHandlers = () => {
  api.get.mockImplementation((...args) => {
    const config = args[1];
    return withDelay(() => getHandler(...args), config);
  });
  api.post.mockImplementation((...args) => {
    const [url] = args;
    const config = args.length > 2 ? args[2] : args[1];
    return withDelay(() => {
      if (shouldFail(url)) {
        return rejectHttp(500, `forced fail: ${url}`);
      }
      const typed = findTypedFailure(url);
      if (typed) {
        return rejectHttp(typed.status ?? 500, typed.message ?? `forced fail: ${url}`, typed);
      }
      const flaky = findFlakyFailure(url);
      if (flaky) {
        flaky.count += 1;
        return rejectHttp(flaky.status ?? 503, flaky.message ?? `flaky fail: ${url}`, flaky);
      }
      if (config?.signal?.aborted) {
        return Promise.reject(createAbortError());
      }
      return postHandler(...args);
    }, config);
  });
};

applyHandlers();

api.__mock = {
  reset() {
    getHandler = defaultGet;
    postHandler = defaultPost;
    delayMs = 0;
    failMatchers = [];
    typedFailures = [];
    flakyFailures = [];
    __auditLogs = [];
    __waChats = new Map();
    __waBus = null;
    __waOpts = { readReceipts: true, autoDeliverMs: 40, autoReadMs: 80 };
    api.get.mockClear();
    api.post.mockClear();
    applyHandlers();
  },
  setGet(fn) {
    getHandler = typeof fn === 'function' ? fn : defaultGet;
    applyHandlers();
  },
  setPost(fn) {
    postHandler = typeof fn === 'function' ? fn : defaultPost;
    applyHandlers();
  },
  setDelay(ms) {
    delayMs = Number(ms) || 0;
  },
  failOn(matcher) {
    if (Array.isArray(matcher)) {
      failMatchers.push(...matcher);
    } else if (matcher) {
      failMatchers.push(matcher);
    }
  },
  failWith(matcher, opts = {}) {
    const entries = Array.isArray(matcher) ? matcher : [matcher];
    const parsedStatus = Number(opts.status);
    const status = Number.isFinite(parsedStatus) ? parsedStatus : 500;
    for (const entry of entries) {
      if (!entry) continue;
      typedFailures.push({
        matcher: entry,
        status,
        message: opts.message,
        data: opts.data,
        headers: opts.headers,
      });
    }
  },
  failNTimes(matcher, times = 1, opts = {}) {
    const entries = Array.isArray(matcher) ? matcher : [matcher];
    const parsedTimes = Number(times);
    const normalizedTimes = Number.isFinite(parsedTimes) ? Math.max(0, parsedTimes) : 0;
    const parsedStatus = Number(opts.status);
    const status = Number.isFinite(parsedStatus) ? parsedStatus : 503;
    for (const entry of entries) {
      if (!entry) continue;
      flakyFailures.push({
        matcher: entry,
        times: normalizedTimes,
        status,
        message: opts.message,
        data: opts.data,
        headers: opts.headers,
        count: 0,
      });
    }
  },
  // WhatsApp helpers
  waBus() {
    if (!__waBus) {
      // bus minimalista compatível com integrations/whatsapp/events.js
      const map = new Map();
      __waBus = {
        on(evt, cb) {
          const arr = map.get(evt) || [];
          arr.push(cb);
          map.set(evt, arr);
          return () => __waBus.off(evt, cb);
        },
        off(evt, cb) {
          const arr = map.get(evt) || [];
          const i = arr.indexOf(cb);
          if (i >= 0) arr.splice(i, 1);
          map.set(evt, arr);
        },
        emit(evt, payload) {
          (map.get(evt) || []).forEach((cb) => {
            try {
              cb(payload);
            } catch {}
          });
        },
        clear() {
          map.clear();
        },
      };
    }
    return __waBus;
  },
  waOptions(opts) {
    Object.assign(__waOpts, opts || {});
  },
  waState() {
    return { chats: __waChats };
  },
  waInjectIncoming({
    chatId,
    from,
    text = "olá",
    type = "text",
    media = null,
    context = null,
  } = {}) {
    if (!chatId) {
      throw new Error("waInjectIncoming requer chatId");
    }
    const bus = api.__mock.waBus();
    const now = Date.now();
    const author = typeof from === "undefined" ? chatId : from;
    const msg = {
      id: `wai-${now}-${Math.random().toString(36).slice(2)}`,
      chatId,
      from: author,
      to: "me",
      direction: "in",
      type,
      text,
      media,
      context,
      timestamp: now,
      status: "sent",
    };
    const store = __waChats.get(chatId) || { messages: [] };
    store.messages.push(msg);
    __waChats.set(chatId, store);
    setTimeout(() => {
      bus.emit("wa:message", { ...msg });
    }, 0);
    setTimeout(() => {
      bus.emit("wa:status", {
        chatId,
        messageId: msg.id,
        status: "delivered",
        timestamp: Date.now(),
      });
    }, __waOpts.autoDeliverMs);
    if (__waOpts.readReceipts) {
      setTimeout(() => {
        bus.emit("wa:status", {
          chatId,
          messageId: msg.id,
          status: "read",
          timestamp: Date.now(),
        });
      }, __waOpts.autoReadMs);
    }
    return msg;
  },
  waTyping({ chatId, from, state = "composing" } = {}) {
    if (!chatId) {
      throw new Error("waTyping requer chatId");
    }
    const bus = api.__mock.waBus();
    const author = typeof from === "undefined" ? chatId : from;
    bus.emit("wa:typing", {
      chatId,
      from: author,
      state,
      timestamp: Date.now(),
    });
  },
  logs() {
    return __auditLogs.slice();
  },
};

// (opcional) se seu código usa interceptors, mantenha um stub seguro
api.interceptors = api.interceptors || {
  request: { use: () => {} },
  response: { use: () => {} },
};

// Oferece compatibilidade com axios.create nos testes
api.create = (config) => makeClient(config);

// Exponha utilidades no default (alguns testes chamam via default)
api.__mockRoute = __mockRoute;
api.__resetMockApi = __resetMockApi;
api.__getLastRequest = __getLastRequest;
api.__setFeatures = __setFeatures;
api.__setLimits = __setLimits;
api.__setProgressScenario = __setProgressScenario;

export default api;
export {
  __mockRoute,
  __resetMockApi,
  __getLastRequest,
  __setFeatures,
  __setLimits,
  __setProgressScenario,
  searchOrgs,
  searchClients,
  getPlanFeatures,
  savePlanFeatures,
};

