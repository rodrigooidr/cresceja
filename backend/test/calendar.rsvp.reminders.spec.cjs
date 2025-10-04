/* eslint-env jest */
import express from 'express';
const request = require('supertest');

const queryMock = jest.fn();
const auditMock = { auditLog: jest.fn() };

let remindersRouter;
let rsvpRouter;

beforeAll(async () => {
  await jest.unstable_mockModule('#db', () => ({ query: (...args) => queryMock(...args) }));
  const authHandler = (req, _res, next) => {
    req.user = { id: 'agent', email: 'agent@example.com', org_id: 'org-1' };
    next();
  };
  await jest.unstable_mockModule('../middleware/auth.js', () => ({
    requireAuth: authHandler,
    authRequired: authHandler,
    default: authHandler,
  }));
  await jest.unstable_mockModule('../services/audit.js', () => ({
    default: auditMock,
  }));
  ({ default: remindersRouter } = await import('../routes/calendar.reminders.js'));
  ({ default: rsvpRouter } = await import('../routes/calendar.rsvp.js'));
});

beforeEach(() => {
  queryMock.mockReset();
  auditMock.auditLog.mockReset();
  global.fetch = jest.fn(async (url, options) => {
    const target = String(url);
    if (target.includes('/api/whatsapp/send')) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    if (target.includes('/api/inbox/messages')) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: false, status: 404, json: async () => ({ ok: false }) };
  });
});

afterAll(() => {
  delete global.fetch;
});

test('run reminders envia WhatsApp e marca reminder_sent_at', async () => {
  process.env.REMINDERS_WHATSAPP_ENABLED = 'true';

  let reminderUpdated = false;
  queryMock.mockImplementation(async (sql, params) => {
    const text = String(sql);
    if (text.includes('FROM public.calendar_events ce')) {
      return {
        rows: [
          {
            id: 'loc-1',
            org_id: 'org-1',
            summary: 'Consulta',
            start_at: '2025-09-23T17:00:00.000Z',
            end_at: '2025-09-23T18:00:00.000Z',
            calendar_id: 'Rodrigo',
            contact_id: 'c1',
            rsvp_status: 'pending',
            display_name: 'Cliente',
            phone_e164: '+5511999999999',
          },
        ],
      };
    }
    if (text.includes('SELECT rsvp_token FROM public.calendar_events')) {
      return { rows: [{ rsvp_token: null }] };
    }
    if (text.includes('UPDATE public.calendar_events SET rsvp_token')) {
      return { rows: [] };
    }
    if (text.includes('UPDATE public.calendar_events SET reminder_sent_at')) {
      reminderUpdated = true;
      return { rows: [] };
    }
    return { rows: [] };
  });

  const app = express();
  app.use(express.json());
  app.use(remindersRouter);

  const response = await request(app)
    .post('/calendar/reminders/run')
    .send({ hours: 24 });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(expect.objectContaining({ ok: true, sent: 1, hours: 24 }));
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/whatsapp/send'),
    expect.objectContaining({ method: 'POST' })
  );
  expect(reminderUpdated).toBe(true);
});

test('rsvp confirm marca status', async () => {
  queryMock.mockImplementation(async (sql) => {
    const text = String(sql);
    if (text.includes('UPDATE public.calendar_events') && text.includes('rsvp_status')) {
      return { rows: [{ id: 'loc-1', contact_id: 'c1', org_id: 'org-1' }] };
    }
    if (text.includes('FROM public.conversations')) {
      return { rows: [{ id: 'conv-1' }] };
    }
    return { rows: [] };
  });

  const app = express();
  app.use(express.json());
  app.use(rsvpRouter);

  const res = await request(app).post('/calendar/rsvp').send({ token: 'abc', action: 'confirm' });

  expect(res.status).toBe(200);
  expect(res.body).toEqual(expect.objectContaining({ ok: true, status: 'confirmed' }));
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/inbox/messages'),
    expect.objectContaining({ method: 'POST' })
  );
});
