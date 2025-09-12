/* eslint-disable no-undef */
const request = require('supertest');

let app;
let db;

async function mkOrg() {
  const { rows } = await db.query(
    'INSERT INTO organizations (name, email, status) VALUES ($1,$2,$3) RETURNING id',
    ['Org Test', `org_${Date.now()}@test.local`, 'Ativo']
  );
  const id = rows[0].id;
  await db.query(
    `INSERT INTO org_settings (org_id, allow_baileys, whatsapp_active_mode)
     VALUES ($1, $2, $3)
     ON CONFLICT (org_id) DO UPDATE
     SET allow_baileys = EXCLUDED.allow_baileys,
         whatsapp_active_mode = EXCLUDED.whatsapp_active_mode`,
    [id, true, 'none']
  );
  return id;
}

describe('WhatsApp status & exclusividade', () => {
  let orgId;

  beforeAll(async () => {
    ({ default: app } = await import('../app.js'));
    db = (await import('../config/db.js')).default;
    orgId = await mkOrg();
  });

  afterAll(async () => {
    if (db?.closePool) await db.closePool();
  });

  test('GET /api/admin/orgs/:id/whatsapp/status retorna shape unificado', async () => {
    const res = await request(app)
      .get(`/api/admin/orgs/${orgId}/whatsapp/status`)
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        mode: expect.stringMatching(/^(none|baileys|api)$/),
        allow_baileys: expect.any(Boolean),
        baileys: expect.objectContaining({
          connected: expect.any(Boolean),
        }),
        api: expect.objectContaining({
          connected: expect.any(Boolean),
        }),
      })
    );
  });

  test('Bloqueia Baileys quando modo ativo = api (409 ExclusiveMode)', async () => {
    await db.query(
      "UPDATE org_settings SET whatsapp_active_mode='api' WHERE org_id=$1",
      [orgId]
    );

    await request(app)
      .post(`/api/admin/orgs/${orgId}/baileys/connect`)
      .send({ phone: '123', allowed_test_emails: ['rodrigooidr@hotmail.com'] })
      .expect(409)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: 'ExclusiveMode',
          active: 'api',
          trying: 'baileys',
        });
      });
  });

  test('Bloqueia API quando modo ativo = baileys (409 ExclusiveMode)', async () => {
    await db.query(
      "UPDATE org_settings SET whatsapp_active_mode='baileys' WHERE org_id=$1",
      [orgId]
    );

    await request(app)
      .post(`/api/admin/orgs/${orgId}/api-whatsapp/connect`)
      .expect(409)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: 'ExclusiveMode',
          active: 'baileys',
          trying: 'api',
        });
      });
  });

  test("Baileys exige allowed_test_emails contendo 'rodrigooidr@hotmail.com' (400 ValidationError)", async () => {
    await db.query(
      "UPDATE org_settings SET whatsapp_active_mode='none', allow_baileys=true WHERE org_id=$1",
      [orgId]
    );

    const res = await request(app)
      .post(`/api/admin/orgs/${orgId}/baileys/connect`)
      .send({ phone: '123', allowed_test_emails: ['alguem@teste.com'] })
      .expect(400);

    expect(res.body.error).toBe('ValidationError');
    expect(JSON.stringify(res.body).toLowerCase()).toContain('allowed_test_emails');
  });

  test("Desconectar API volta modo para 'none'", async () => {
    await db.query(
      "UPDATE org_settings SET whatsapp_active_mode='api' WHERE org_id=$1",
      [orgId]
    );

    await request(app)
      .post(`/api/admin/orgs/${orgId}/api-whatsapp/disconnect`)
      .expect(200);

    const status = await request(app)
      .get(`/api/admin/orgs/${orgId}/whatsapp/status`)
      .expect(200);

    expect(status.body.mode).toBe('none');
  });
});
