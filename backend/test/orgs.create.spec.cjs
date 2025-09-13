/* eslint-disable no-undef */
const request = require('supertest');
const { Client } = require('pg');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const runInt = process.env.RUN_INT_TESTS === 'true';

let container;
let app;
let client;

const BOOT_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION util_digits(text) RETURNS text AS $$
  SELECT regexp_replace($1, '\\D', '', 'g');
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION util_email_lower(text) RETURNS text AS $$
  SELECT lower($1);
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text,
  razao_social text,
  nome_fantasia text,
  ie text,
  ie_isento boolean DEFAULT false,
  site text,
  email text,
  phone_e164 text,
  status text DEFAULT 'active',
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  country text DEFAULT 'BR',
  resp_nome text,
  resp_cpf text,
  resp_email text,
  resp_phone_e164 text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid,
  period text,
  trial_start timestamptz,
  trial_end timestamptz,
  created_at timestamptz DEFAULT now()
);
`;

const basePayload = {
  cnpj: '45.723.174/0001-10',
  razao_social: 'Org Teste',
  nome_fantasia: 'Org',
  ie_isento: false,
  site: 'https://exemplo.com',
  email: 'org1@test.com',
  phone_e164: '+5511987654321',
  endereco: {
    cep: '01310100',
    logradouro: 'Rua A',
    numero: '100',
    bairro: 'Centro',
    cidade: 'São Paulo',
    uf: 'SP',
    country: 'BR',
  },
  responsavel: {
    nome: 'Fulano',
    email: 'fulano@test.com',
  },
};

(runInt ? describe : describe.skip)('POST /api/admin/orgs', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const connectionString = container.getConnectionUri();
    process.env.DATABASE_URL = connectionString;

    client = new Client({ connectionString });
    await client.connect();
    await client.query(BOOT_SQL);

    app = (await import('../app.js')).default;
  }, 120000);

  afterAll(async () => {
    try { if (client) await client.end(); } catch {}
    if (container) await container.stop();
  });

  test('cria organização válida', async () => {
    const res = await request(app).post('/api/admin/orgs').send(basePayload).expect(201);
    expect(res.body).toHaveProperty('id');
  });

  test('bloqueia duplicatas por cnpj, email e telefone', async () => {
    // já existe org criada no teste anterior
    await request(app)
      .post('/api/admin/orgs')
      .send({ ...basePayload, email: 'other@test.com', phone_e164: '+5511999999999' })
      .expect(409);

    await request(app)
      .post('/api/admin/orgs')
      .send({
        ...basePayload,
        cnpj: '11.222.333/0001-81',
        phone_e164: '+5511999999999',
      })
      .expect(409);

    await request(app)
      .post('/api/admin/orgs')
      .send({
        ...basePayload,
        cnpj: '40.688.134/0001-61',
        email: 'org3@test.com',
      })
      .expect(409);
  });

  test('retorna 422 em validação', async () => {
    await request(app)
      .post('/api/admin/orgs')
      .send({
        ...basePayload,
        cnpj: '04.252.011/0001-10',
        email: null,
        phone_e164: null,
      })
      .expect(422);
  });
});

