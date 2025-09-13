/* eslint-disable no-undef */
const request = require("supertest");
const { Client } = require("pg");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");
const runInt = process.env.RUN_INT_TESTS === 'true';

let container;
let app;
let client;

const BOOT_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_mode_enum') THEN
    CREATE TYPE whatsapp_mode_enum AS ENUM ('none','baileys','api');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  status text DEFAULT 'Ativo',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_settings (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  allow_baileys boolean NOT NULL DEFAULT false,
  whatsapp_active_mode whatsapp_mode_enum NOT NULL DEFAULT 'none',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  mode text,
  status text,
  created_at timestamptz DEFAULT now()
);
`;

async function mkOrg() {
  const ins = await client.query(
    "INSERT INTO organizations (name, email, status) VALUES ($1,$2,$3) RETURNING id",
    ["Org Test", `org_${Date.now()}@test.local`, "Ativo"]
  );
  const orgId = ins.rows[0].id;

  await client.query(
    `INSERT INTO org_settings (org_id, allow_baileys, whatsapp_active_mode)
     VALUES ($1, true, 'none')
     ON CONFLICT (org_id) DO UPDATE
     SET allow_baileys = EXCLUDED.allow_baileys,
         whatsapp_active_mode = EXCLUDED.whatsapp_active_mode`,
    [orgId]
  );
  return orgId;
}

(runInt ? describe : describe.skip)("WhatsApp status & exclusividade (com Postgres efêmero)", () => {
  let orgId;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const connectionString = container.getConnectionUri();
    process.env.DATABASE_URL = connectionString;

    client = new Client({ connectionString });
    await client.connect();
    await client.query(BOOT_SQL);

    app = (await import("../app.js")).default;

    orgId = await mkOrg();
  }, 120000);

  afterAll(async () => {
    try { if (client) await client.end(); } catch {}
    if (container) await container.stop();
  });

  test("GET /api/admin/orgs/:id/whatsapp/status retorna shape unificado", async () => {
    const res = await request(app).get(`/api/admin/orgs/${orgId}/whatsapp/status`).expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        mode: expect.stringMatching(/^(none|baileys|api)$/),
        allow_baileys: expect.any(Boolean),
        baileys: expect.objectContaining({ connected: expect.any(Boolean) }),
        api: expect.objectContaining({ connected: expect.any(Boolean) })
      })
    );
  });

  test("Bloqueia Baileys quando modo ativo = api (409 ExclusiveMode)", async () => {
    await client.query("UPDATE org_settings SET whatsapp_active_mode='api' WHERE org_id=$1", [orgId]);
    const r = await request(app)
      .post(`/api/admin/orgs/${orgId}/baileys/connect`)
      .send({ phone: "123", allowed_test_emails: ["rodrigooidr@hotmail.com"] })
      .expect(409);
    expect(r.body).toMatchObject({ error: "ExclusiveMode", active: "api", trying: "baileys" });
  });

  test("Bloqueia API quando modo ativo = baileys (409 ExclusiveMode)", async () => {
    await client.query("UPDATE org_settings SET whatsapp_active_mode='baileys' WHERE org_id=$1", [orgId]);
    const r = await request(app).post(`/api/admin/orgs/${orgId}/api-whatsapp/connect`).expect(409);
    expect(r.body).toMatchObject({ error: "ExclusiveMode", active: "baileys", trying: "api" });
  });

  test("Baileys exige allowed_test_emails contendo 'rodrigooidr@hotmail.com' (400 ValidationError)", async () => {
    await client.query("UPDATE org_settings SET whatsapp_active_mode='none', allow_baileys=true WHERE org_id=$1", [orgId]);
    const r = await request(app)
      .post(`/api/admin/orgs/${orgId}/baileys/connect`)
      .send({ phone: "123", allowed_test_emails: ["alguem@teste.com"] })
      .expect(400);
    expect(r.body.error).toBe("ValidationError");
  });

  test("Desconectar API volta modo para 'none'", async () => {
    await client.query("UPDATE org_settings SET whatsapp_active_mode='api' WHERE org_id=$1", [orgId]);
    await request(app).post(`/api/admin/orgs/${orgId}/api-whatsapp/disconnect`).expect(200);
    const s = await request(app).get(`/api/admin/orgs/${orgId}/whatsapp/status`).expect(200);
    expect(s.body.mode).toBe("none");
  });
});

