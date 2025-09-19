// Força o uso dos mocks manuais para API em TODAS as suites
try { jest.mock('@/api/inboxApi'); } catch {}
try { jest.mock('@/api/index'); } catch {}

// frontend/test/setup.jest.cjs
// Extensões úteis do RTL
try { require('@testing-library/jest-dom'); } catch {}

const g = globalThis;

// --- EventSource (SSE) ---
if (typeof g.EventSource !== 'function') {
  class FakeEventSource {
    constructor() { this.readyState = 0; this.url = ''; }
    addEventListener() {}
    removeEventListener() {}
    close() { this.readyState = 2; }
    onopen() {}
    onmessage() {}
    onerror() {}
  }
  g.EventSource = FakeEventSource;
}

// --- matchMedia ---
if (!g.matchMedia) {
  g.matchMedia = () => ({
    matches: false, media: '', onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {},
    dispatchEvent() { return false; }
  });
}

// --- ResizeObserver ---
if (!g.ResizeObserver) {
  g.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// --- IntersectionObserver ---
if (!g.IntersectionObserver) {
  g.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

// --- URL.createObjectURL ---
if (!g.URL) g.URL = {};
if (!g.URL.createObjectURL) g.URL.createObjectURL = () => 'blob:jest';
if (!g.URL.revokeObjectURL) g.URL.revokeObjectURL = () => {};

// --- scrollTo ---
if (!g.scrollTo) g.scrollTo = () => {};

// --- crypto.getRandomValues ---
try {
  const { webcrypto } = require('crypto');
  if (!g.crypto) g.crypto = webcrypto;
  if (!g.crypto.getRandomValues && webcrypto?.getRandomValues) {
    g.crypto.getRandomValues = webcrypto.getRandomValues.bind(webcrypto);
  }
} catch { /* ignore */ }

// --- TextEncoder/Decoder (Node 18+ já tem, mas deixamos compat) ---
try {
  const { TextEncoder, TextDecoder } = require('util');
  if (!g.TextEncoder) g.TextEncoder = TextEncoder;
  if (!g.TextDecoder) g.TextDecoder = TextDecoder;
} catch { /* ignore */ }

// --- fetch (Node 18+ tem; se não tiver, usa whatwg-fetch) ---
if (typeof g.fetch !== 'function') {
  try { require('whatwg-fetch'); } catch {
    try { g.fetch = require('node-fetch'); } catch { /* ignore */ }
  }
}

// --- Augmentação dos mocks de API: garante jest.fn e helpers __mock ---
// Mantém comportamento original, mas permite .mockResolvedValue / asserts de chamadas.
// NÃO altera arquivos em src/api/__mocks__.

function __ensureMockClient(mod) {
  if (!mod) return;
  const client = mod.default || mod;
  if (!client) return;

  const methods = ['get', 'post', 'put', 'delete'];

  const ensureState = () => {
    if (!client.__mockState) {
      client.__mockState = {
        base: {},
        defaults: {},
        failRules: { get: [], post: [], put: [], delete: [] },
        interceptors: { get: [], post: [], put: [], delete: [] },
        auditLogs: [],
        crm: new Map(),
        timers: new Set(),
        wa: null,
        interceptorsConfigured: false,
      };
    }
    return client.__mockState;
  };

  const state = ensureState();

  const toMatcher = (matcher) => {
    if (typeof matcher === 'function') return matcher;
    if (matcher instanceof RegExp) {
      return (value) => matcher.test(String(value || ''));
    }
    if (matcher == null) return () => true;
    const expected = String(matcher);
    return (value) => String(value || '') === expected;
  };

  const defaultError = (method, target) => {
    const err = new Error(`mock fail for ${method.toUpperCase()} ${target || ''}`.trim());
    err.status = 500;
    return err;
  };

  const handled = (value) => ({ __handled: true, value });

  const normalizePhone = (phone) => (phone == null ? null : String(phone).replace(/[^0-9+]/g, ''));

  const ensureBus = () => {
    if (state.wa) return state.wa;
    const { EventEmitter } = require('events');
    const emitter = new EventEmitter();
    if (typeof emitter.setMaxListeners === 'function') emitter.setMaxListeners(50);
    const waState = {
      emitter,
      options: { readReceipts: false, autoDeliverMs: 80, autoReadMs: 160 },
      conversations: new Map(),
      typing: new Map(),
    };
    state.wa = waState;
    return waState;
  };

  const createDefaultImpl = (method) => async (url, ...rest) => {
    const currentState = ensureState();
    const rules = currentState.failRules[method] || [];
    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i];
      if (rule.matcher(url, rest)) {
        if (rule.remaining !== Infinity) {
          rule.remaining -= 1;
          if (rule.remaining <= 0) {
            rules.splice(i, 1);
            i -= 1;
          }
        }
        throw rule.error;
      }
    }

    const interceptors = currentState.interceptors[method] || [];
    for (const interceptor of interceptors) {
      const result = await interceptor(url, ...rest);
      if (result && result.__handled) return result.value;
    }

    const baseFn = currentState.base[method];
    return baseFn ? baseFn(url, ...rest) : undefined;
  };

  const ensureMethod = (method) => {
    const fn = client[method];
    if (typeof fn !== 'function') return;

    if (!state.base[method]) {
      if (fn._isMockFunction && typeof fn.getMockImplementation === 'function') {
        const impl = fn.getMockImplementation();
        state.base[method] = impl ? impl.bind(client) : fn.bind(client);
      } else {
        state.base[method] = fn.bind(client);
      }
    }

    if (!state.defaults[method]) {
      state.defaults[method] = createDefaultImpl(method);
    }

    if (fn._isMockFunction) {
      if (!fn._isJestWrapped) {
        fn._isJestWrapped = true;
      }
      fn.mockImplementation(state.defaults[method]);
      return;
    }

    const wrapped = jest.fn(state.defaults[method]);
    wrapped._isJestWrapped = true;
    client[method] = wrapped;
  };

  methods.forEach(ensureMethod);

  const ensureConversation = (chatId) => {
    const wa = ensureBus();
    const key = chatId || 'chat';
    if (!wa.conversations.has(key)) {
      wa.conversations.set(key, { messages: [] });
    }
    return wa.conversations.get(key);
  };

  const appendMessage = (chatId, message) => {
    const conv = ensureConversation(chatId);
    const existingIndex = conv.messages.findIndex((msg) => msg.id === message.id);
    if (existingIndex >= 0) conv.messages.splice(existingIndex, 1);
    conv.messages.push(message);
  };

  const scheduleStatus = (payload, delay) => {
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = setTimeout(() => {
      state.timers.delete(timer);
      const wa = ensureBus();
      wa.emitter.emit('wa:status', payload);
    }, delay);
    state.timers.add(timer);
  };

  const buildMessage = ({ chatId, to, from, text, media, direction }) => ({
    id: `wa-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
    chatId,
    from,
    to,
    direction,
    type: media?.type || (text ? 'text' : 'unknown'),
    text: text || '',
    media: media || null,
    timestamp: Date.now(),
    status: 'sent',
    context: null,
  });

  if (!state.interceptorsConfigured) {
    state.interceptorsConfigured = true;

    // Auditoria (/gov/logs)
    state.interceptors.post.push(async (url, body = {}) => {
      if (!/^\/gov\/logs/.test(String(url))) return null;
      state.auditLogs.push({
        event: body?.event || null,
        payload: body?.payload ?? {},
        actor: body?.actor ?? null,
        timestamp: Date.now(),
      });
      return handled({ data: { ok: true } });
    });

    state.interceptors.get.push(async (url) => {
      const match = String(url || '').match(/^\/gov\/logs(?:\?(.*))?$/);
      if (!match) return null;
      const params = new URLSearchParams(match[1] || '');
      const eventFilter = params.get('event');
      const limit = Number(params.get('limit') || '0');
      let items = state.auditLogs.slice();
      if (eventFilter) items = items.filter((entry) => entry.event === eventFilter);
      if (Number.isFinite(limit) && limit > 0) items = items.slice(-limit);
      return handled({ data: { items } });
    });

    // CRM
    state.interceptors.get.push(async (url) => {
      const match = String(url || '').match(/^\/crm\/contacts\?(.*)$/);
      if (!match) return null;
      const params = new URLSearchParams(match[1]);
      const phone = normalizePhone(params.get('phone'));
      const contact = phone ? state.crm.get(phone) || null : null;
      return handled({ data: { contact } });
    });

    state.interceptors.post.push(async (url, body = {}) => {
      if (String(url || '') !== '/crm/contacts') return null;
      const phone = normalizePhone(body.phone || body.chatId || body.id);
      const contact = {
        id: body.id || phone || `contact-${Date.now()}`,
        phone: phone || null,
        name: body.name || body.displayName || 'Contato',
        email: body.email || '',
        birthdate: body.birthdate || body.birthday || null,
        tags: Array.isArray(body.tags) ? body.tags.slice() : [],
        channel: body.channel || 'whatsapp',
        createdAt: body.createdAt || Date.now(),
        updatedAt: Date.now(),
        ...body,
      };
      if (phone) state.crm.set(phone, contact);
      return handled({ data: { contact } });
    });

    // WhatsApp endpoints
    state.interceptors.get.push(async (url) => {
      const match = String(url || '').match(/^\/whatsapp\/(cloud|baileys)\/history\?(.*)$/);
      if (!match) return null;
      const params = new URLSearchParams(match[2] || '');
      const chatId = params.get('chatId') || params.get('conversationId') || '';
      const conv = ensureConversation(chatId);
      return handled({ data: { items: conv.messages.slice(), nextCursor: null } });
    });

    state.interceptors.post.push(async (url, body = {}, config = {}) => {
      const path = String(url || '');
      const wa = ensureBus();

      const isCloudSend = path === '/whatsapp/cloud/send' || path === '/whatsapp/cloud/sendMedia';
      const isBaileysSend = path === '/whatsapp/baileys/send' || path === '/whatsapp/baileys/sendMedia';
      if (!isCloudSend && !isBaileysSend) return null;

      const chatId = body.chatId || body.to || 'chat';
      const media = body.media || null;
      const message = buildMessage({
        chatId,
        to: body.to || chatId,
        from: 'agent',
        text: body.text || body.caption || '',
        media,
        direction: 'out',
      });
      appendMessage(chatId, message);

      wa.emitter.emit('wa:message', message);

      const headers = config?.headers || {};
      const idempotency = headers['Idempotency-Key'] || headers['idempotency-key'] || null;
      const transport = isCloudSend ? 'cloud' : 'baileys';
      state.auditLogs.push({
        event: 'whatsapp.send.success',
        payload: { transport, chatId, to: message.to, kind: media ? media.type : 'text', idempotency },
        actor: null,
        timestamp: Date.now(),
      });

      const delayDeliver = wa.options.autoDeliverMs;
      const delayRead = wa.options.autoReadMs;
      if (Number.isFinite(delayDeliver) && delayDeliver > 0) {
        scheduleStatus({ chatId, messageId: message.id, status: 'delivered', timestamp: Date.now() + delayDeliver }, delayDeliver);
      }
      if (Number.isFinite(delayRead) && delayRead > 0) {
        scheduleStatus({ chatId, messageId: message.id, status: 'read', timestamp: Date.now() + delayDeliver + delayRead }, delayDeliver + delayRead);
      }

      return handled({ data: { message, idempotency } });
    });

    state.interceptors.post.push(async (url, body = {}) => {
      const path = String(url || '');
      if (path !== '/whatsapp/cloud/markRead' && path !== '/whatsapp/baileys/markRead') return null;
      const chatId = body.chatId;
      const messageId = body.messageId;
      const wa = ensureBus();
      wa.emitter.emit('wa:status', { chatId, messageId, status: 'read', timestamp: Date.now() });
      return handled({ data: { ok: true } });
    });

    state.interceptors.post.push(async (url, body = {}) => {
      const path = String(url || '');
      if (path !== '/whatsapp/cloud/typing' && path !== '/whatsapp/baileys/typing') return null;
      const wa = ensureBus();
      wa.emitter.emit('wa:typing', { chatId: body.chatId, state: body.state || 'composing', timestamp: Date.now(), from: 'agent' });
      return handled({ data: { ok: true } });
    });
  }

  if (!client.__mock) client.__mock = {};
  const ns = client.__mock;

  if (!ns.failNTimes) {
    ns.failNTimes = jest.fn((first, second, third, fourth) => {
      let method = 'get';
      let matcher = first;
      let times = second;
      let error = third;
      if (typeof first === 'string' && /^[a-z]+$/i.test(first)) {
        method = first.toLowerCase();
        matcher = second;
        times = third;
        error = fourth;
      }
      method = methods.includes(method) ? method : 'get';
      const attempts = Number(times ?? 1);
      const rule = {
        matcher: toMatcher(matcher),
        remaining: Number.isFinite(attempts) ? Math.max(0, attempts) : 0,
        error: error || defaultError(method, matcher),
      };
      if (rule.remaining === 0 && error !== fourth) {
        rule.remaining = 1;
      }
      if (rule.remaining === 0 && times === undefined) {
        rule.remaining = 1;
      }
      if (third === undefined && fourth === undefined && typeof second === 'number') {
        rule.remaining = Math.max(0, second);
      }
      if (!Number.isFinite(rule.remaining) || rule.remaining <= 0) {
        rule.remaining = 1;
      }
      state.failRules[method].push(rule);
    });
  }

  if (!ns.failWith) {
    ns.failWith = jest.fn((matcher, error, method = 'post') => {
      const errObj = error || defaultError(method, matcher);
      state.failRules[methods.includes(method) ? method : 'post'].push({
        matcher: toMatcher(matcher),
        remaining: Infinity,
        error: errObj,
      });
    });
  }

  if (!ns.failOn) {
    ns.failOn = jest.fn((matcher, error, method = 'post') => {
      const errObj = error || defaultError(method, matcher);
      state.failRules[methods.includes(method) ? method : 'post'].push({
        matcher: toMatcher(matcher),
        remaining: 1,
        error: errObj,
      });
    });
  }

  const routeFn = mod.__mockRoute || mod.default?.__mockRoute;
  if (!ns.route) {
    if (typeof routeFn === 'function') {
      ns.route = jest.fn((methodPath, handler) => routeFn(methodPath, handler));
    } else {
      ns.route = jest.fn(() => {});
    }
  }

  if (!ns.setDelay) {
    ns.setDelay = jest.fn((ms) => {
      if (typeof client.__setDelay === 'function') client.__setDelay(ms);
    });
  }

  if (!ns.crmSeed) {
    ns.crmSeed = jest.fn((contact) => {
      if (!contact) return;
      const phone = normalizePhone(contact.phone || contact.id);
      if (!phone) return;
      const entry = { ...contact, phone };
      state.crm.set(phone, entry);
    });
  }

  if (!ns.logs) {
    ns.logs = jest.fn(() => state.auditLogs.slice());
  }

  if (!ns.waBus) {
    ns.waBus = jest.fn(() => {
      const wa = ensureBus();
      return {
        on(event, cb) {
          if (typeof cb !== 'function') return () => {};
          wa.emitter.on(event, cb);
          return () => wa.emitter.off(event, cb);
        },
        off(event, cb) {
          wa.emitter.off(event, cb);
        },
        emit(event, payload) {
          wa.emitter.emit(event, payload);
        },
        clear() {
          wa.emitter.removeAllListeners();
        },
      };
    });
  }

  if (!ns.waOptions) {
    ns.waOptions = jest.fn((opts = {}) => {
      const wa = ensureBus();
      wa.options = { ...wa.options, ...opts };
    });
  }

  if (!ns.waInjectIncoming) {
    ns.waInjectIncoming = jest.fn((message = {}) => {
      const wa = ensureBus();
      const chatId = message.chatId || message.from || message.to || 'chat';
      const payload = {
        id: message.id || `wa-in-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
        chatId,
        from: chatId,
        to: 'agent',
        direction: 'in',
        type: message.type || (message.media?.type || 'text'),
        text: message.text || '',
        media: message.media || null,
        timestamp: message.timestamp || Date.now(),
        status: message.status || 'sent',
        context: message.context || null,
      };
      const conv = ensureConversation(chatId);
      const idx = conv.messages.findIndex((msg) => msg.id === payload.id);
      if (idx >= 0) conv.messages.splice(idx, 1);
      conv.messages.push(payload);
      wa.emitter.emit('wa:message', payload);
    });
  }

  if (!ns.waTyping) {
    ns.waTyping = jest.fn((typing = {}) => {
      const wa = ensureBus();
      wa.emitter.emit('wa:typing', {
        chatId: typing.chatId || typing.conversationId || 'chat',
        state: typing.state || 'composing',
        timestamp: typing.timestamp || Date.now(),
        from: typing.from || 'user',
      });
    });
  }

  if (!ns.reset) {
    ns.reset = jest.fn(() => {
      methods.forEach((method) => {
        const mockFn = client[method];
        if (mockFn?.mockReset) {
          mockFn.mockReset();
          if (state.defaults[method]) {
            mockFn.mockImplementation(state.defaults[method]);
          }
        }
        state.failRules[method] = [];
      });
      state.auditLogs = [];
      state.crm.clear();
      if (typeof client.__setDelay === 'function') client.__setDelay(0);
      for (const timer of Array.from(state.timers)) {
        clearTimeout(timer);
        state.timers.delete(timer);
      }
      if (state.wa) {
        state.wa.emitter.removeAllListeners();
        state.wa.conversations.clear();
        state.wa.typing.clear?.();
        state.wa.options = { readReceipts: false, autoDeliverMs: 80, autoReadMs: 160 };
      }
    });
  }
}

// Garante que os mocks tenham jest.fn e helpers __mock
try { __ensureMockClient(require('@/api/inboxApi')); } catch {}
try { __ensureMockClient(require('@/api/index')); } catch {}

