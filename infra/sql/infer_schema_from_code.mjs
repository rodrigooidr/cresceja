#!/usr/bin/env node
/**
 * infer_schema_from_code.mjs (fixed)
 * Scans a repo (JS/TS/SQL) to infer Postgres DDL.
 * - Avoids problematic regex for comma splitting (uses a safe parser).
 */

import fs from 'node:fs';
import path from 'node:path';

const REPO = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
if (!fs.existsSync(REPO)) {
  console.error('Repo not found:', REPO);
  process.exit(1);
}

const TYPE_RULES = [
  { test: n => /(^|_)id$/.test(n), type: 'uuid' },
  { test: n => /_ids$/.test(n), type: 'uuid[]' },
  { test: n => /(created|updated|deleted|sent|received|occurred|finished|paid|due|erased|published|scheduled)_at$/.test(n), type: 'timestamptz' },
  { test: n => /(date|birthdate)$/.test(n), type: 'date' },
  { test: n => /(^is_|_enabled$|_active$|^has_|_sent$|_done$|_ok$|_flag$)/.test(n), type: 'boolean' },
  { test: n => /(count|_qty|_quantity|_score|_status_code|_version)$/.test(n), type: 'integer' },
  { test: n => /(cents|_ms|_bytes|_size|_width|_height|_duration)$/.test(n), type: 'integer' },
  { test: n => /(price|amount|valor|value_num|latitude|longitude)$/.test(n), type: 'numeric' },
  { test: n => /(json|_json|_map|_meta|_metadata|_config|_creds|_secrets|_permissions|_targets|_refs)$/.test(n), type: 'jsonb' },
  { test: n => /(tags)$/.test(n), type: 'text[]' },
  { test: n => /(email)$/.test(n), type: 'citext' },
  { test: n => /(phone|phone_e164|cpf|cnpj|cep)$/.test(n), type: 'text' },
];

const DEFAULTS_BY_TYPE = {
  'uuid': 'DEFAULT gen_random_uuid()',
  'timestamptz': 'DEFAULT now()',
  'boolean': 'DEFAULT false',
  'jsonb': "DEFAULT '{}'::jsonb",
  'text[]': "DEFAULT ARRAY[]::text[]",
};

const FK_MAP = {
  org_id: 'organizations',
  user_id: 'users',
  author_id: 'users',
  assigned_to: 'users',
  handoff_ack_by: 'users',
  client_id: 'clients',
  contact_id: 'contacts',
  lead_id: 'leads',
  opportunity_id: 'crm_opportunities',
  conversation_id: 'conversations',
  message_id: 'messages',
  post_id: 'posts',
  page_id: 'facebook_pages',
  account_id: 'instagram_accounts',
  calendar_id: 'calendars',
  instagram_account_id: 'instagram_accounts',
  facebook_page_id: 'facebook_pages',
  google_account_id: 'google_calendar_accounts',
};

function guessType(col) {
  const n = col.toLowerCase();
  for (const rule of TYPE_RULES) if (rule.test(n)) return rule.type;
  if (n === 'email') return 'citext';
  if (n === 'status') return 'text';
  if (n === 'name' || n === 'title') return 'text';
  return 'text';
}
function guessDefault(type, col) {
  if (col === 'id' && type === 'uuid') return 'DEFAULT gen_random_uuid()';
  if (DEFAULTS_BY_TYPE[type]) return DEFAULTS_BY_TYPE[type];
  return null;
}
function qident(x){ return '"' + String(x).replace(/"/g,'""') + '"'; }

function walk(dir, files=[]) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist' || ent.name === 'build') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else if (/\.(sql|js|ts|cjs|mjs|sqlx)$/i.test(ent.name)) files.push(full);
  }
  return files;
}

const RE_INSERT = /insert\s+into\s+([a-zA-Z0-9_"]+)\s*\(([^)]+)\)/ig;
const RE_UPDATE = /update\s+([a-zA-Z0-9_"]+)\s+set\s+([^;]+)/ig;
const RE_SELECT = /select\s+([\s\S]*?)\s+from\s+([a-zA-Z0-9_"]+)/ig;
const RE_CREATE = /create\s+table\s+if\s+not\s+exists\s+([a-zA-Z0-9_"]+)\s*\(([\s\S]*?)\);/ig;

const tables = new Map(); // tname -> { cols:Set, sources:Set }
const foundFKs = new Map(); // tname -> Set(JSON)

function ensureTable(t) {
  const name = t.toLowerCase().replace(/"/g, '');
  if (!tables.has(name)) tables.set(name, { cols: new Set(), sources: new Set() });
  return tables.get(name);
}
function addCol(t, col) {
  if (!col) return;
  col = col.trim().replace(/["`]/g, '');
  if (!col) return;
  ensureTable(t).cols.add(col);
}

function splitByCommasOutsideParens(s){
  const res=[]; let cur=''; let depth=0;
  for (let i=0;i<s.length;i++){
    const ch=s[i];
    if (ch==='(') depth++;
    else if (ch===')' && depth>0) depth--;
    if (ch===',' && depth===0){ res.push(cur); cur=''; }
    else { cur+=ch; }
  }
  if (cur.trim()!=='') res.push(cur);
  return res;
}

function parseCreate(body, tname) {
  const parts = splitByCommasOutsideParens(body);
  for (let ln of parts) {
    ln = ln.trim();
    const mcol = ln.match(/^"?(?<col>[a-zA-Z0-9_]+)"?\s+[a-zA-Z0-9_\[\]\(\):]+/);
    if (mcol && mcol.groups && mcol.groups.col) addCol(tname, mcol.groups.col);
    const mfk = ln.match(/foreign key\s*\(([^)]+)\)\s*references\s+([a-zA-Z0-9_"]+)/i);
    if (mfk) {
      const cols = mfk[1].split(',').map(s=>s.replace(/["\s]/g,'').trim());
      const ref = mfk[2].replace(/"/g,'');
      for (const c of cols) {
        addCol(tname, c);
        if (!foundFKs.has(tname)) foundFKs.set(tname, new Set());
        foundFKs.get(tname).add(JSON.stringify({ col: c, refTable: ref }));
      }
    }
  }
}

for (const file of walk(REPO)) {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = RE_INSERT.exec(src))) {
    const table = m[1].replace(/"/g, '');
    const cols = m[2].split(',').map(s => s.trim().replace(/["`]/g, ''));
    for (const c of cols) addCol(table, c);
    ensureTable(table).sources.add(file);
  }
  while ((m = RE_UPDATE.exec(src))) {
    const table = m[1].replace(/"/g, '');
    const setPart = m[2];
    const cols = setPart.split(',').map(s => s.split('=')[0].trim().replace(/["`]/g, ''));
    for (const c of cols) addCol(table, c);
    ensureTable(table).sources.add(file);
  }
  while ((m = RE_SELECT.exec(src))) {
    const table = m[2].replace(/"/g, '');
    ensureTable(table).sources.add(file);
  }
  while ((m = RE_CREATE.exec(src))) {
    const table = m[1].replace(/"/g, '');
    parseCreate(m[2], table);
    ensureTable(table).sources.add(file);
  }
}

// Ensure base cols
for (const [t, data] of tables) {
  if (!data.cols.has('id')) data.cols.add('id');
  if (!data.cols.has('created_at')) data.cols.add('created_at');
  if (!data.cols.has('updated_at')) data.cols.add('updated_at');
}

// Infer FKs by *_id naming
for (const [t, data] of tables) {
  for (const c of data.cols) {
    if (c.endsWith('_id') && c !== 'id') {
      const ref = FK_MAP[c] || (c.slice(0, -3) + 's');
      if (!foundFKs.has(t)) foundFKs.set(t, new Set());
      foundFKs.get(t).add(JSON.stringify({ col: c, refTable: ref }));
    }
  }
}

// Emit DDL
const lines = [];
lines.push('-- == INFERRED DDL (heuristic) ==');
lines.push('SET client_min_messages = WARNING;');
lines.push('SET search_path = public, pg_catalog;');
lines.push('CREATE EXTENSION IF NOT EXISTS plpgsql;');
lines.push('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
lines.push('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
lines.push('CREATE EXTENSION IF NOT EXISTS citext;');
lines.push('');

for (const [t, data] of tables) {
  const cols = [];
  for (const c of Array.from(data.cols).sort()) {
    let ty = guessType(c);
    let dflt = guessDefault(ty, c);
    let extras = '';
    if (c === 'id' && ty === 'uuid') extras = ' PRIMARY KEY';
    cols.push('  ' + qident(c) + ' ' + ty + (dflt ? ' ' + dflt : '') + extras);
  }
  lines.push(`CREATE TABLE IF NOT EXISTS ${qident(t)} (\n${cols.join(',\n')}\n);`);
  lines.push('');
}

for (const [t, fksSet] of foundFKs) {
  const arr = Array.from(fksSet).map(s => JSON.parse(s));
  let i = 0;
  for (const fk of arr) {
    const name = qident(`${t}_fk_${++i}`);
    lines.push(`ALTER TABLE ${qident(t)} ADD CONSTRAINT ${name} FOREIGN KEY (${qident(fk.col)}) REFERENCES ${qident(fk.refTable)} ("id") ON DELETE SET NULL;`);
  }
}

lines.push('');
lines.push('CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$');
lines.push('BEGIN');
lines.push('  IF NEW IS DISTINCT FROM OLD THEN NEW.updated_at := now(); END IF;');
lines.push('  RETURN NEW;');
lines.push('END $$;');

lines.push('');
lines.push('DO $$');
lines.push('DECLARE rec record; BEGIN');
lines.push("  FOR rec IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='updated_at' LOOP");
lines.push("    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', rec.table_name||'_set_updated_at', rec.table_name);");
lines.push('  END LOOP;');
lines.push('EXCEPTION WHEN others THEN NULL; END $$;');

console.log(lines.join('\n'));
