/* eslint-disable no-undef */
const request = require('supertest');
const express = require('express');

const ORG_ID = '11111111-1111-1111-1111-111111111111';

let telemetryRouter;

beforeAll(async () => {
  ({ default: telemetryRouter } = await import('../routes/telemetry.js'));
});

describe('GET /api/orgs/:orgId/telemetry/summary', () => {
  it('returns aggregated cards for admins', async () => {
    const app = express();
    app.use(express.json());

    const fakeDb = {
      query: jest.fn(async (sql) => {
        if (sql.includes('event_key = ANY')) {
          return { rows: [{ total: 12 }] };
        }
        if (sql.includes("event_key = 'ai.autoreply.sent'")) {
          return { rows: [{ total: 5 }] };
        }
        if (sql.includes("event_key = 'handoff.requested'")) {
          return { rows: [{ total: 3 }] };
        }
        if (sql.includes('AVG(EXTRACT')) {
          return { rows: [{ seconds: 45 }] };
        }
        throw new Error('Unexpected SQL in test');
      }),
    };

    app.use((req, _res, next) => {
      req.db = fakeDb;
      req.user = { id: 'agent', role: 'OrgAdmin', org_id: ORG_ID };
      next();
    });

    app.use(telemetryRouter);

    const res = await request(app)
      .get(`/api/orgs/${ORG_ID}/telemetry/summary`)
      .set('X-Org-Id', ORG_ID);

    expect(res.statusCode).toBe(200);
    expect(res.body.cards).toMatchObject({
      messages: 12,
      ai_autoreplies: 5,
      handoffs: 3,
      handoff_mtta_seconds: 45,
    });
    expect(fakeDb.query).toHaveBeenCalledTimes(4);
  });
});
