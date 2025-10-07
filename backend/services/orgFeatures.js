// services/orgFeatures.js

// Fallback seguro de query caso 'db' não seja fornecido
import { query as rootQuery } from '#db';

const q = (db) =>
  (db && typeof db.query === 'function')
    ? (text, params) => db.query(text, params)
    : (text, params) => rootQuery(text, params);

// Normaliza argumentos para suportar os dois estilos de chamada:
// getOrgFeatures(orgId, db)  OU  getOrgFeatures(db, orgId)
function parseGetArgs(a, b) {
  if (a && typeof a.query === 'function') return { db: a, orgId: b };
  return { orgId: a, db: b };
}

// setOrgFeatures(orgId, patch, db)  OU  setOrgFeatures(db, orgId, patch)
function parseSetArgs(...args) {
  if (args[0] && typeof args[0].query === 'function') {
    return { db: args[0], orgId: args[1], patch: args[2] ?? {} };
  }
  return { orgId: args[0], patch: args[1] ?? {}, db: args[2] };
}

export async function getOrgFeatures(a, b) {
  const { db, orgId } = parseGetArgs(a, b);
  if (!orgId) return {};
  const { rows } = await q(db)(
    'SELECT features FROM org_features WHERE org_id = $1',
    [orgId]
  );
  return rows?.[0]?.features ?? {};
}

export async function setOrgFeatures(...args) {
  const { db, orgId, patch } = parseSetArgs(...args);
  if (!orgId) throw new Error('org_id_required');
  const features = (patch && typeof patch === 'object') ? patch : {};
  await q(db)(
    `
    INSERT INTO org_features (org_id, features)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (org_id) DO UPDATE
      SET features   = org_features.features || EXCLUDED.features,
          updated_at = now()
    `,
    [orgId, JSON.stringify(features)]
  );
}
