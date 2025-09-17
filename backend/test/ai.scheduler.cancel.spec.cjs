/* eslint-env jest */

const { EventEmitter } = require('events');

let schedulerBot;
const stateStore = new Map();

beforeAll(async () => {
  const queryMock = jest.fn(async (sql, params) => {
    if (/SELECT ai_status FROM public\.conversations/.test(sql)) {
      const id = params[0];
      return { rows: [{ ai_status: stateStore.get(id) || '' }] };
    }
    if (/UPDATE public\.conversations SET ai_status/.test(sql)) {
      const [id, payload] = params;
      if (payload) stateStore.set(id, payload);
      else stateStore.delete(id);
      return { rows: [] };
    }
    if (/FROM public\.channel_accounts/.test(sql)) {
      return { rows: [{ name: 'Rodrigo', permissions_json: { aliases: ['rod'], slotMin: 30 } }] };
    }
    if (/FROM public\.org_ai_settings/.test(sql)) {
      return { rows: [{ collect_fields: { appointment_services: [{ name: 'Consulta', durationMin: 60 }] } }] };
    }
    return { rows: [] };
  });

  await jest.unstable_mockModule('#db', () => ({ query: queryMock }));
  await jest.unstable_mockModule('node-fetch', () => ({ default: jest.fn(async () => ({ ok: true, json: async () => ({}) })) }));

  const requestMock = (opts, cb) => {
    const { method, path } = opts;
    const req = new EventEmitter();
    req.write = jest.fn();
    req.on = req.addListener.bind(req);
    req.end = jest.fn(() => {
      const res = new EventEmitter();
      process.nextTick(() => {
        if (method === 'GET' && String(path).startsWith('/api/calendar/events')) {
          res.statusCode = 200;
          cb(res);
          res.emit('data', Buffer.from(JSON.stringify({
            items: [{
              id: 'loc-1', external_event_id: 'evt-1', calendar_id: 'cal1',
              summary: 'Consulta', start_at: '2025-09-23T17:00:00.000Z', end_at: '2025-09-23T18:00:00.000Z'
            }]
          })));
          res.emit('end');
          return;
        }
        if (method === 'DELETE' && String(path).startsWith('/api/calendar/events/evt-1')) {
          res.statusCode = 200;
          cb(res);
          res.emit('data', Buffer.from(JSON.stringify({ ok: true })));
          res.emit('end');
          return;
        }
        res.statusCode = 200;
        cb(res);
        res.emit('data', Buffer.from('{}'));
        res.emit('end');
      });
    });
    return req;
  };

  await jest.unstable_mockModule('node:http', () => ({ default: { request: requestMock } }));

  schedulerBot = await import('../services/ai/scheduler.bot.js');
});

beforeEach(() => {
  stateStore.clear();
});

describe('scheduler.bot — cancelamento', () => {
  test('cancela evento único encontrado', async () => {
    stateStore.set('conv-1', JSON.stringify({ flow: 'schedule', step: 'cancel_await', draft: {}, candidates: [] }));
    const r = await schedulerBot.handleIncoming({
      orgId: 'org-1',
      conversationId: 'conv-1',
      text: '23/09/2025 às 14h',
      contact: { id: 'c1', display_name: 'Cliente' }
    });
    expect(r.handled).toBe(true);
    expect((r.messages || []).some((m) => /cancelado com sucesso/i.test(m.text))).toBe(true);
  });
});
