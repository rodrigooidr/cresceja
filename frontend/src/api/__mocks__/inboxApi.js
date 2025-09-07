const makeResp = (over = {}) => ({ data: { items: [], ...over } });
const now = '2024-01-01T12:00:00Z';

const api = {
  get: jest.fn(async (url) => {
    if (url.includes('/inbox/conversations')) {
      return {
        data: {
          items: [
            { id: 'c1', name: 'Alice', last_message_at: now, updated_at: now, status: 'open' },
            { id: 'c2', name: 'Bob',   last_message_at: now, updated_at: now, status: 'open' },
          ],
          total: 2,
        },
      };
    }
    if (/\/inbox\/conversations\/([^/]+)\/messages/.test(url)) {
      const [, id] = url.match(/\/inbox\/conversations\/([^/]+)\/messages/) || [];
      return {
        data: {
          items: [
            // mensagem que os testes procuram
            { id: 'm1', conversation_id: id, text: 'hi',     direction: 'in',  sender: 'contact', created_at: now },
            { id: 'm2', conversation_id: id, text: 'reply',  direction: 'out', sender: 'agent',   created_at: now, status: 'sent' },
          ],
          total: 2,
        },
      };
    }
    if (url.includes('/inbox/templates')) {
      return { data: [{ id: 't1', title: 'Boas-vindas', text: 'Bem-vindo(a)!' }] };
    }
    if (url.includes('/inbox/quick') || url.includes('/quick-repl')) {
      return { data: [{ id: 'q1', title: 'Olá!', content: 'Olá, como posso ajudar?' }] };
    }
    if (url.includes('/channels/summary')) {
      return { data: {
        whatsapp_official: { status: 'disconnected' },
        whatsapp_baileys:  { status: 'disconnected' },
        instagram:         { status: 'disconnected' },
        facebook:          { status: 'disconnected' },
        google_calendar:   { status: 'disconnected' },
      }};
    }
    return makeResp();
  }),
  post: jest.fn(async (url, body) => {
    if (url.includes('/inbox/messages')) {
      return { data: {
        id: 'mX',
        conversation_id: body?.conversationId || body?.conversation_id || 'c1',
        text: body?.message || body?.text || '',
        sender: 'agent',
        direction: 'out',
        created_at: now,
        status: 'sent',
      }};
    }
    return makeResp();
  }),
  put: jest.fn(async () => makeResp()),
  delete: jest.fn(async () => makeResp()),
  request: jest.fn(async () => makeResp()),
  interceptors: { request: { use: jest.fn(), eject: jest.fn() }, response: { use: jest.fn(), eject: jest.fn() } },
  defaults: { headers: { common: {} } },
  create: jest.fn(() => api),
};

export const setAuthToken = jest.fn();
export const clearAuthToken = jest.fn();
export const apiUrl = 'http://localhost:4000/api';

export default api;
