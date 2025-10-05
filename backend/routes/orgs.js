// backend/routes/orgs.js (ESM)
import { Router } from "express";
import { query as dbQuery } from "#db"; // mantém seu client já usado noutros módulos

const router = Router();

/* --- Auth mínimo (evita ReferenceError e garante req.user) --- */
const requireAuth = (req, res, next) => {
  if (req?.user?.id) return next();
  return res.status(401).json({ error: "unauthorized" });
};

/* --- Regras de acesso: SuperAdmin / Support têm acesso global --- */
function hasGlobalAccess(user) {
  const roles = new Set([user?.role, ...(user?.roles || [])].filter(Boolean));
  return roles.has("SuperAdmin") || roles.has("Support");
}

/* =========================================================================
   GET /api/orgs
   - SuperAdmin/Support: lista TODAS
   - Demais (OrgOwner/OrgAdmin/OrgAgent): apenas onde há vínculo em org_users
   ========================================================================= */
router.get("/", requireAuth, async (req, res, next) => {
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
router.post("/select", requireAuth, async (req, res) => {
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
router.get("/current", requireAuth, async (req, res, next) => {
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

export default router;
