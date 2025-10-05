// backend/routes/orgs.js (ESM)
import { Router } from "express";
import { query as dbQuery } from "#db"; // mantém seu client já usado noutros módulos
import { requireAuth, requireSuperAdmin } from "../middlewares/auth.js";
import slugify from "slugify";
import { z } from "zod";

const router = Router();

/* --- Auth mínimo (evita ReferenceError e garante req.user) --- */
const fallbackRequireAuth = (req, res, next) => {
  if (req?.user?.id) return next();
  return res.status(401).json({ error: "unauthorized" });
};

const ensureAuth = (req, res, next) => {
  try {
    if (typeof requireAuth === "function") {
      return requireAuth(req, res, next);
    }
  } catch {}
  return fallbackRequireAuth(req, res, next);
};

const fallbackRequireSuperAdmin = (req, res, next) => {
  const roles = new Set([req?.user?.role, ...(req?.user?.roles || [])].filter(Boolean));
  if (roles.has("SuperAdmin")) return next();
  return res.status(403).json({ error: "forbidden" });
};

const ensureSuperAdmin = (req, res, next) => {
  try {
    if (typeof requireSuperAdmin === "function") {
      return requireSuperAdmin(req, res, next);
    }
  } catch {}
  return fallbackRequireSuperAdmin(req, res, next);
};

/* --- Regras de acesso: SuperAdmin / Support têm acesso global --- */
function hasGlobalAccess(user) {
  const roles = new Set([user?.role, ...(user?.roles || [])].filter(Boolean));
  return roles.has("SuperAdmin") || roles.has("Support");
}

async function getBillingHistoryForOrg(db, orgId) {
  const client = db?.query ? db : { query: dbQuery };
  const safeQuery = async (sql, params) => {
    try {
      const { rows } = await client.query(sql, params);
      return rows || [];
    } catch {
      return [];
    }
  };

  const invoices = await safeQuery(
    `SELECT * FROM invoices WHERE org_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [orgId]
  );

  const plan_events = await safeQuery(
    `SELECT * FROM org_plan_events WHERE org_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [orgId]
  );

  const usage = await safeQuery(
    `SELECT * FROM org_credits_usage WHERE org_id = $1 ORDER BY period_start DESC LIMIT 200`,
    [orgId]
  );

  return { invoices, plan_events, usage };
}

/* =========================================================================
   GET /api/orgs
   - SuperAdmin/Support: lista TODAS
   - Demais (OrgOwner/OrgAdmin/OrgAgent): apenas onde há vínculo em org_users
   ========================================================================= */
router.get("/", ensureAuth, async (req, res, next) => {
  try {
    if (hasGlobalAccess(req.user)) {
      const { rows } = await dbQuery(
        `SELECT *
           FROM public.organizations
          ORDER BY COALESCE(nome_fantasia, name, slug)`
      );
      return res.json({ data: rows });
    }

    const { rows } = await dbQuery(
      `SELECT o.*
         FROM public.organizations o
         JOIN public.org_users ou ON ou.org_id = o.id
        WHERE ou.user_id = $1
        ORDER BY COALESCE(o.nome_fantasia, o.name, o.slug)`,
      [req.user.id]
    );
    return res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/* =========================================================================
   POST /api/orgs/select   { orgId }
   - Troca a organização ativa (sem exigir que o header X-Org-Id já esteja setado)
   - SuperAdmin/Support podem selecionar qualquer uma
   - Demais, somente onde têm vínculo
   ========================================================================= */
router.post("/select", ensureAuth, async (req, res) => {
  try {
    const { orgId } = req.body || {};
    if (!orgId) return res.status(400).json({ error: "org_id_required" });

    const userId = req.user.id;

    let allowed = hasGlobalAccess(req.user);
    if (!allowed) {
      const chk = await dbQuery(
        "SELECT 1 FROM public.org_users WHERE user_id = $1 AND org_id = $2 LIMIT 1",
        [userId, orgId]
      );
      allowed = chk.rowCount > 0;
    }
    if (!allowed) return res.status(403).json({ error: "forbidden_org" });

    // (opcional) grava last_org_id se existir essa coluna
    try {
      await dbQuery("UPDATE public.users SET last_org_id = $1 WHERE id = $2", [
        orgId,
        userId,
      ]);
    } catch {}

    // devolve resumo da org para conveniência do front
    const { rows } = await dbQuery(
      "SELECT id, name, slug, status, plan_id, created_at, updated_at FROM public.organizations WHERE id = $1",
      [orgId]
    );
    const org = rows?.[0] || { id: orgId };

    return res.json({ ok: true, org });
  } catch (err) {
    req.log?.error?.({ err }, "orgs/select failed");
    return res.status(500).json({ error: "server_error" });
  }
});

/* =========================================================================
   GET /api/orgs/current
   - Lê org ativa do header X-Org-Id (prioritário), depois req.user.org_id
   - Verifica permissão (membro ou acesso global)
   ========================================================================= */
router.get("/current", ensureAuth, async (req, res, next) => {
  try {
    const orgId =
      req.headers["x-org-id"] || req.org?.id || req.user?.org_id || null;

    if (!orgId) return res.status(404).json({ error: "no_active_org" });

    const { rows } = await dbQuery(
      "SELECT * FROM public.organizations WHERE id = $1 LIMIT 1",
      [orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "org_not_found" });
    const org = rows[0];

    if (!hasGlobalAccess(req.user)) {
      const chk = await dbQuery(
        "SELECT 1 FROM public.org_users WHERE user_id = $1 AND org_id = $2 LIMIT 1",
        [req.user.id, orgId]
      );
      if (chk.rowCount === 0) {
        return res.status(403).json({ error: "forbidden_org" });
      }
    }

    return res.json(org);
  } catch (err) {
    next(err);
  }
});

// ===== CODEx: BEGIN org plan/status/history endpoints =====
// PUT /api/admin/orgs/:id/plan  -> define plano da organização
router.put("/admin/orgs/:id/plan", ensureAuth, async (req, res) => {
  const id = req.params.id;
  const db = req.db?.query ? req.db : { query: dbQuery };

  const schema = z.object({
    plan_id: z.string().uuid(),
  });
  const body = schema.parse(req.body || {});

  await db.query(
    `UPDATE organizations SET plan_id = $1, updated_at = NOW() WHERE id = $2`,
    [body.plan_id, id]
  );

  // log de evento (tabela opcional; se não existir, ignore o erro silenciosamente)
  try {
    await db.query(
      `INSERT INTO org_plan_events (org_id, event_type, data)
       VALUES ($1,'plan_updated', $2::jsonb)`,
      [id, JSON.stringify({ plan_id: body.plan_id })]
    );
  } catch {}

  res.json({ ok: true });
});

// PATCH /api/admin/orgs/:id/status  -> ativa/inativa/suspende
router.patch("/admin/orgs/:id/status", ensureAuth, async (req, res) => {
  const id = req.params.id;
  const db = req.db?.query ? req.db : { query: dbQuery };
  const schema = z.object({
    status: z.enum(["active", "inactive", "suspended"]),
  });
  const { status } = schema.parse(req.body || {});

  await db.query(
    `UPDATE organizations SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id]
  );

  try {
    await db.query(
      `INSERT INTO org_plan_events (org_id, event_type, data)
       VALUES ($1,'status_changed', $2::jsonb)`,
      [id, JSON.stringify({ status })]
    );
  } catch {}

  res.json({ ok: true });
});

// GET /api/admin/orgs/:id/billing/history  -> histórico consolidado
router.get("/admin/orgs/:orgId/billing/history", ensureAuth, ensureSuperAdmin, async (req, res) => {
  const { orgId } = req.params;
  const hist = await getBillingHistoryForOrg(req.db, orgId);
  return res.json({ ok: true, data: hist });
});

router.get("/orgs/:orgId/billing/history", ensureAuth, async (req, res) => {
  const { orgId } = req.params;
  const user = req.user || {};

  const isSameOrg = user.org_id === orgId;
  const roles = new Set([...(user.roles || []), user.role].filter(Boolean));
  const isPrivileged = roles.has("SuperAdmin") || roles.has("OrgAdmin") || roles.has("OrgOwner");

  if (!isPrivileged || (!roles.has("SuperAdmin") && !isSameOrg)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const hist = await getBillingHistoryForOrg(req.db, orgId);
  return res.json({ ok: true, data: hist });
});
// ===== CODEx: END org plan/status/history endpoints =====

export default router;
