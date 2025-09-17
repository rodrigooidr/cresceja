/* eslint-env jest */

const { EventEmitter } = require('events');

let schedulerBot;
let queryMock;
let fetchMock;
const stateStore = new Map();

beforeAll(async () => {
  fetchMock = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      items: {
        Rodrigo: [
          { start: '2025-09-23T17:00:00.000Z', end: '2025-09-23T18:00:00.000Z' },
        ],
      },
    }),
  }));

  const requestMock = jest.fn((options, callback) => {
    const req = new EventEmitter();
    req.write = jest.fn();
    req.end = jest.fn(() => {
      const res = new EventEmitter();
      res.statusCode = 200;
      process.nextTick(() => {
        callback(res);
        res.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              id: 'evt-1',
              summary: 'Consulta',
              start: '2025-09-23T17:00:00.000Z',
              end: '2025-09-23T18:00:00.000Z',
            }),
          ),
        );
        res.emit('end');
      });
    });
    req.on = req.addListener.bind(req);
    return req;
  });

  queryMock = jest.fn(async (sql, params) => {
    if (/FROM public\.channel_accounts/.test(sql)) {
      return {
        rows: [
          {
            name: 'Rodrigo',
            permissions_json: { aliases: ['rod'], skills: ['consulta'], slotMin: 30 },
          },
        ],
      };
    }
    if (/FROM public\.org_ai_settings/.test(sql)) {
      return {
        rows: [
          {
            collect_fields: {
              appointment_services: [
                { name: 'Consulta', durationMin: 60, defaultSkill: 'consulta' },
              ],
            },
          },
        ],
      };
    }
    if (/SELECT ai_status FROM public\.conversations/.test(sql)) {
      const id = params[0];
      return { rows: [{ ai_status: stateStore.get(id) || '' }] };
    }
    if (/UPDATE public\.conversations SET ai_status/.test(sql)) {
      const [id, payload] = params;
      stateStore.set(id, payload || '');
      return { rows: [] };
    }
    return { rows: [] };
  });

  await jest.unstable_mockModule('#db', () => ({ query: queryMock }));
  await jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
  await jest.unstable_mockModule('node:http', () => ({ default: { request: requestMock } }));

  schedulerBot = await import('../services/ai/scheduler.bot.js');
});

beforeEach(() => {
  stateStore.clear();
  fetchMock.mockClear();
  queryMock.mockClear();
});

describe('scheduler.bot', () => {
  test('fluxo direto: agendar com pessoa/data/hora', async () => {
    const r = await schedulerBot.handleIncoming({
      orgId: 'org-1',
      conversationId: 'conv-1',
      text: 'Quero agendar uma consulta com Rodrigo dia 23/09/2025 às 14h',
      contact: { id: 'c1', display_name: 'Cliente' },
    });
    expect(r.handled).toBe(true);
    expect((r.messages || []).some((m) => /Posso agendar/i.test(m.text))).toBe(true);
  });

  test('incremental: faltando dados pede profissional e horário', async () => {
    const r = await schedulerBot.handleIncoming({
      orgId: 'org-1',
      conversationId: 'conv-2',
      text: 'Quero agendar',
      contact: null,
    });
    expect(r.handled).toBe(true);
    expect((r.messages || [])[0].text).toMatch(/preciso de profissional e data e hora/i);
  });
});
