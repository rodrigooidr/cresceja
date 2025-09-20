const express = require('express');
const request = require('supertest');

let requireRole;
let ROLES;
let defaultExport;

beforeAll(async () => {
  const module = await import('../middleware/requireRole.js');
  requireRole = module.requireRole || module.default?.requireRole || module.default;
  ROLES = module.ROLES || module.default?.ROLES;
  defaultExport = module.default;
});

describe('requireRole middleware', () => {
  it('exposes requireRole in default export for CommonJS interop', () => {
    expect(typeof defaultExport).toBe('function');
    expect(typeof defaultExport.requireRole).toBe('function');
    expect(typeof defaultExport.ROLES).toBe('object');
  });

  it('keeps public routes accessible', async () => {
    const app = express();
    app.get('/public', (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/public');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 403 when user lacks role', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: 'user-1' };
      next();
    });
    app.get('/protected', requireRole(ROLES.OrgAdmin), (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/protected');
    expect(res.statusCode).toBe(403);
  });

  it('allows requests when role matches', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: 'user-1', role: ROLES.OrgAdmin };
      next();
    });
    app.get('/protected', requireRole(ROLES.OrgAdmin), (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/protected');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
