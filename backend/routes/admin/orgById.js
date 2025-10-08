// backend/routes/admin/orgById.js
import { Router } from "express";
import { z } from "zod";
import { db } from "./orgs.shared.js";
import authRequired from "../../middleware/auth.js";
import { requireRole, ROLES } from "../../middleware/requireRole.js";
import { withOrgId } from "../../middleware/withOrgId.js";
import { startForOrg, stopForOrg } from "../../services/baileysService.js";

const ADMIN_ROLES = new Set(["SuperAdmin", "Support"]);
const router = Router({ mergeParams: true });

router.use(authRequired);
router.use(requireRole([ROLES.SuperAdmin, ROLES.Support]));
router.use(withOrgId);

function resolveOrgId(req) {
  return req.orgId || req.params.orgId;
}

// ---------- helpers defensivos ----------
async function tableExists(table) {
  const { rows } = await db.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  return !!rows.length;
}

async function colExists(table, col) {
  const { rows } = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, col]
  );
  return !!rows.length;
}

async function safeQuery(sql, params = []) {
  try {
    const { rows } = await db.query(sql, params);
    return rows || [];
  } catch (e) {
    // 42P01 = table not found, 42703 = column not found
    if (e?.code === "42P01" || e?.code === "42703") return [];
    throw e;
  }
}

async function ensureOrgSettings() {
  if (!(await tableExists("org_settings"))) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.org_settings (
        org_id uuid PRIMARY KEY,
        allow_baileys boolean DEFAULT false,
        whatsapp_active_mode text DEFAULT 'none',
        updated_at timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now()
      )
    `);
  }
}

// ---------- validações ----------
const BaseUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).nullable().optional(),
  status: z.enum(["active", "inactive", "suspended", "canceled"]).optional(),
  plan_id: z.string().uuid().nullable().optional(),
  trial_ends_at: z.string().min(1).nullable().optional(),
  document_type: z.enum(["CNPJ", "CPF"]).nullable().optional(),
  document_value: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  phone_e164: z.string().nullable().optional(),
  razao_social: z.string().nullable().optional(),
  nome_fantasia: z.string().nullable().optional(),
  site: z.string().url().nullable().optional(),
  ie: z.string().nullable().optional(),
  ie_isento: z.boolean().optional(),
  cep: z.string().nullable().optional(),
  logradouro: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  uf: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  resp_nome: z.string().nullable().optional(),
  resp_cpf: z.string().nullable().optional(),
  resp_email: z.string().email().nullable().optional(),
  resp_phone_e164: z.string().nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  meta: z.any().optional(),
}).partial();

const AdminOnlySchema = z.object({
  whatsapp_baileys_enabled: z.boolean().optional(),
  whatsapp_mode: z.enum(["baileys", "none"]).optional(),
  whatsapp_baileys_status: z.string().nullable().optional(),
  whatsapp_baileys_phone: z.string().nullable().optional(),
}).partial();

const OrgUpdateSchema = BaseUpdateSchema.merge(AdminOnlySchema);

// ---------- PATCH /api/admin/orgs/:orgId ----------
router.patch("/", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const parsed = OrgUpdateSchema.parse(req.body || {});

    const roles = Array.isArray(req.user?.roles)
      ? req.user.roles
      : req.user?.role
      ? [req.user.role]
      : [];
    const canManageBaileys = roles.some((r) => ADMIN_ROLES.has(r));

    const assignString = (v) =>
      v === undefined ? undefined : v === null ? null : String(v).trim() || null;

    const baseUpdates = {
      name: parsed.name?.trim(),
      slug: assignString(parsed.slug),
      status: parsed.status,
      plan_id: assignString(parsed.plan_id),
      trial_ends_at: assignString(parsed.trial_ends_at),
      document_type: assignString(parsed.document_type),
      document_value: assignString(parsed.document_value),
      email: assignString(parsed.email)?.toLowerCase() ?? undefined,
      phone: assignString(parsed.phone),
      phone_e164: assignString(parsed.phone_e164),
      razao_social: assignString(parsed.razao_social),
      nome_fantasia: assignString(parsed.nome_fantasia),
      site: assignString(parsed.site),
      ie: assignString(parsed.ie),
      ie_isento: parsed.ie_isento === undefined ? undefined : !!parsed.ie_isento,
      cep: assignString(parsed.cep),
      logradouro: assignString(parsed.logradouro),
      numero: assignString(parsed.numero),
      complemento: assignString(parsed.complemento),
      bairro: assignString(parsed.bairro),
      cidade: assignString(parsed.cidade),
      uf: assignString(parsed.uf)?.toUpperCase() ?? undefined,
      country: assignString(parsed.country),
      resp_nome: assignString(parsed.resp_nome),
      resp_cpf: assignString(parsed.resp_cpf),
      resp_email: assignString(parsed.resp_email)?.toLowerCase() ?? undefined,
      resp_phone_e164: assignString(parsed.resp_phone_e164),
      photo_url: assignString(parsed.photo_url),
      meta:
        parsed.meta === undefined
          ? undefined
          : parsed.meta === null
          ? null
          : typeof parsed.meta === "string"
          ? parsed.meta
          : JSON.stringify(parsed.meta),
    };

    const adminUpdates = canManageBaileys
      ? {
          whatsapp_baileys_enabled:
            parsed.whatsapp_baileys_enabled === undefined
              ? undefined
              : !!parsed.whatsapp_baileys_enabled,
          whatsapp_mode: parsed.whatsapp_mode || "none",
          whatsapp_baileys_status: assignString(parsed.whatsapp_baileys_status),
          whatsapp_baileys_phone: assignString(parsed.whatsapp_baileys_phone),
        }
      : {};

    // filtra somente campos presentes E colunas existentes na tabela
    const candidateUpdates = Object.entries({ ...baseUpdates, ...adminUpdates })
      .filter(([, v]) => v !== undefined);

    const allowed = [];
    for (const [k, v] of candidateUpdates) {
      if (await colExists("organizations", k)) {
        allowed.push([k, v]);
      }
    }
    if (!allowed.length) {
      return res.status(400).json({ error: "no_fields_to_update" });
    }

    const params = [];
    const sets = allowed.map(([k, v], i) => {
      // normaliza nulos em chaves opcionais
      if ((k === "plan_id" || k === "trial_ends_at") && !v) v = null;
      params.push(v);
      return `${k}=$${i + 1}`;
    });
    params.push(orgId);

    await db.query(
      `UPDATE public.organizations
          SET ${sets.join(", ")}, updated_at=now()
        WHERE id=$${params.length}`,
      params
    );

    const rows = await safeQuery(
      `SELECT
         o.id, o.name, o.slug, o.status, (o.status='active') AS active,
         o.plan_id, p.name AS plan_name, o.trial_ends_at,
         o.document_type, o.document_value, o.email, o.phone, o.phone_e164,
         o.cnpj, o.razao_social, o.nome_fantasia, o.site, o.ie, o.ie_isento,
         o.cep, o.logradouro, o.numero, o.complemento, o.bairro, o.cidade, o.uf, o.country,
         o.resp_nome, o.resp_cpf, o.resp_email, o.resp_phone_e164,
         o.whatsapp_baileys_enabled, o.whatsapp_mode, o.whatsapp_baileys_status, o.whatsapp_baileys_phone,
         o.photo_url, o.meta, o.updated_at
       FROM public.organizations o
       LEFT JOIN public.plans p ON p.id = o.plan_id
       WHERE o.id=$1`,
      [orgId]
    );

    return res.json({ ok: true, org: rows[0] || null });
  } catch (e) {
    if (e?.code === "23505" && /ux_org_phone_e164/i.test(e?.constraint || "")) {
      return res.status(409).json({
        error: "conflict",
        field: "phone_e164",
        message: "Este telefone já está em uso por outra organização.",
      });
    }
    if (e?.name === "ZodError") {
      return res.status(422).json({ error: "validation", issues: e.issues });
    }
    next(e);
  }
});

// ---------- GET /api/admin/orgs/:orgId ----------
router.get("/", async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const orgRows = await safeQuery(
      `SELECT * FROM public.organizations WHERE id=$1`,
      [orgId]
    );
    if (!orgRows.length) return res.status(404).json({ error: "not_found" });
    const org = orgRows[0];

    let payments = [];
    if (await tableExists("payments")) {
      payments = await safeQuery(
        `SELECT id, status,
                COALESCE(amount_cents,0) AS amount_cents,
                COALESCE(currency,'BRL')  AS currency,
                paid_at, created_at
           FROM public.payments
          WHERE org_id=$1
          ORDER BY created_at DESC
          LIMIT 100`,
        [orgId]
      );
    }

    let purchases = [];
    if (await tableExists("purchases")) {
      purchases = await safeQuery(
        `SELECT id, item, qty, amount_cents, created_at
           FROM public.purchases
          WHERE org_id=$1
          ORDER BY created_at DESC
          LIMIT 100`,
        [orgId]
      );
    }

    return res.json({ org, payments, purchases });
  } catch (e) {
    next(e);
  }
});

// ---------- overview ----------
router.get("/overview", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const rows = await safeQuery(
      `SELECT id, name, razao_social, cnpj, status, created_at
       FROM public.organizations WHERE id=$1`,
      [orgId]
    );
    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json({ overview: rows[0] });
  } catch (e) {
    next(e);
  }
});

// ---------- billing ----------
router.get("/billing", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    let payments = [];
    if (await tableExists("payments")) {
      payments = await safeQuery(
        `SELECT id, status, COALESCE(amount_cents,0) AS amount_cents, paid_at, created_at
         FROM public.payments
         WHERE org_id=$1
         ORDER BY created_at DESC
         LIMIT 20`,
        [orgId]
      );
    }
    res.json({ payments });
  } catch (e) {
    next(e);
  }
});

// ---------- users ----------
router.get("/users", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    if (!(await tableExists("org_users")) || !(await tableExists("users"))) {
      return res.json({ users: [] });
    }
    const users = await safeQuery(
      `SELECT u.id, u.email, COALESCE(ou.role, 'Member') AS role
         FROM public.org_users ou
         JOIN public.users u ON u.id = ou.user_id
        WHERE ou.org_id = $1
        ORDER BY u.email ASC
        LIMIT 50`,
      [orgId]
    );
    res.json({ users });
  } catch (e) {
    next(e);
  }
});

// ---------- logs ----------
router.get("/logs", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const logs = (await tableExists("support_audit_logs"))
      ? await safeQuery(
          `SELECT id, path, method, created_at
             FROM public.support_audit_logs
            WHERE target_org_id=$1
            ORDER BY created_at DESC
            LIMIT 50`,
          [orgId]
        )
      : [];
    res.json({ logs });
  } catch (e) {
    next(e);
  }
});

// ---------- settings ----------
router.get("/settings", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    await ensureOrgSettings();
    const rows = await safeQuery(
      `SELECT allow_baileys, whatsapp_active_mode
       FROM public.org_settings WHERE org_id=$1`,
      [orgId]
    );
    res.json(rows[0] || { allow_baileys: false, whatsapp_active_mode: "none" });
  } catch (e) {
    next(e);
  }
});

router.put("/settings", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { allow_baileys } = req.body ?? {};
    await ensureOrgSettings();
    await db.query(
      `INSERT INTO public.org_settings (org_id, allow_baileys)
       VALUES ($1,$2)
       ON CONFLICT (org_id) DO UPDATE SET allow_baileys=EXCLUDED.allow_baileys, updated_at=now()`,
      [orgId, !!allow_baileys]
    );
    const rows = await safeQuery(
      `SELECT allow_baileys, whatsapp_active_mode
       FROM public.org_settings WHERE org_id=$1`,
      [orgId]
    );
    res.json(rows[0] || { allow_baileys: !!allow_baileys, whatsapp_active_mode: "none" });
  } catch (e) {
    next(e);
  }
});

// ---------- Baileys / API WhatsApp ----------
router.post("/baileys/connect", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { phone, allowed_test_emails } = req.body ?? {};
    if (!phone) return res.status(400).json({ error: "phone_required" });

    await ensureOrgSettings();
    const rows = await safeQuery(
      `SELECT allow_baileys, whatsapp_active_mode
       FROM public.org_settings WHERE org_id=$1`,
      [orgId]
    );
    const settings = rows[0] || { allow_baileys: false, whatsapp_active_mode: "none" };

    if (!settings.allow_baileys) return res.status(403).json({ error: "baileys_not_allowed" });
    if (settings.whatsapp_active_mode === "api") {
      return res.status(409).json({ error: "ExclusiveMode", active: "api", trying: "baileys" });
    }
    if (!Array.isArray(allowed_test_emails) || !allowed_test_emails.includes("rodrigooidr@hotmail.com")) {
      return res.status(400).json({
        error: "ValidationError",
        details: [{ field: "allowed_test_emails", message: "Deve conter 'rodrigooidr@hotmail.com'." }],
      });
    }

    await db.query("BEGIN");
    try {
      await startForOrg(orgId, phone);
      await db.query(
        `INSERT INTO public.org_settings (org_id, whatsapp_active_mode)
         VALUES ($1,'baileys')
         ON CONFLICT (org_id) DO UPDATE SET whatsapp_active_mode='baileys', updated_at=now()`,
        [orgId]
      );
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    }

    const org = (
      await safeQuery(
        `SELECT whatsapp_baileys_enabled, whatsapp_baileys_status, whatsapp_baileys_phone
         FROM public.organizations WHERE id=$1`,
        [orgId]
      )
    )[0] || null;

    res.json({ ok: true, baileys: org, mode: "baileys" });
  } catch (e) {
    next(e);
  }
});

router.post("/baileys/disconnect", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    await stopForOrg(orgId);
    await ensureOrgSettings();
    await db.query(
      `UPDATE public.org_settings
       SET whatsapp_active_mode='none', updated_at=now()
       WHERE org_id=$1 AND whatsapp_active_mode='baileys'`,
      [orgId]
    );
    res.json({ ok: true, mode: "none" });
  } catch (e) {
    next(e);
  }
});

router.get("/baileys/status", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const org = (
      await safeQuery(
        `SELECT whatsapp_baileys_enabled, whatsapp_baileys_status, whatsapp_baileys_phone
         FROM public.organizations WHERE id=$1`,
        [orgId]
      )
    )[0] || {};
    const settings = (
      await safeQuery(
        `SELECT whatsapp_active_mode FROM public.org_settings WHERE org_id=$1`,
        [orgId]
      )
    )[0] || {};
    res.json({ ...org, mode: settings.whatsapp_active_mode || "none" });
  } catch (e) {
    next(e);
  }
});

router.post("/api-whatsapp/connect", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    await ensureOrgSettings();
    const s = (
      await safeQuery(
        `SELECT whatsapp_active_mode FROM public.org_settings WHERE org_id=$1`,
        [orgId]
      )
    )[0] || {};
    if (s.whatsapp_active_mode === "baileys") {
      return res.status(409).json({ error: "ExclusiveMode", active: "baileys", trying: "api" });
    }
    await db.query(
      `INSERT INTO public.org_settings (org_id, whatsapp_active_mode)
       VALUES ($1,'api')
       ON CONFLICT (org_id) DO UPDATE SET whatsapp_active_mode='api', updated_at=now()`,
      [orgId]
    );
    res.json({ ok: true, mode: "api" });
  } catch (e) {
    next(e);
  }
});

router.post("/api-whatsapp/disconnect", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    await ensureOrgSettings();
    await db.query(
      `UPDATE public.org_settings
       SET whatsapp_active_mode='none', updated_at=now()
       WHERE org_id=$1 AND whatsapp_active_mode='api'`,
      [orgId]
    );
    res.json({ ok: true, mode: "none" });
  } catch (e) {
    next(e);
  }
});

router.get("/api-whatsapp/status", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    await ensureOrgSettings();
    const s = (
      await safeQuery(
        `SELECT whatsapp_active_mode FROM public.org_settings WHERE org_id=$1`,
        [orgId]
      )
    )[0] || {};
    res.json({ mode: s.whatsapp_active_mode || "none" });
  } catch (e) {
    next(e);
  }
});

router.get("/whatsapp/status", async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    await ensureOrgSettings();

    const s = (
      await safeQuery(
        `SELECT allow_baileys, whatsapp_active_mode FROM public.org_settings WHERE org_id=$1`,
        [orgId]
      )
    )[0] || {};
    const o = (
      await safeQuery(
        `SELECT whatsapp_baileys_status, updated_at FROM public.organizations WHERE id=$1`,
        [orgId]
      )
    )[0] || {};
    const ch = (await tableExists("channels"))
      ? (
          await safeQuery(
            `SELECT status, updated_at FROM public.channels WHERE org_id=$1 AND type='whatsapp' LIMIT 1`,
            [orgId]
          )
        )[0] || {}
      : {};

    const now = new Date().toISOString();
    res.json({
      mode: s.whatsapp_active_mode || "none",
      allow_baileys: !!s.allow_baileys,
      baileys: {
        connected: o.whatsapp_baileys_status === "connected",
        last_check: o.updated_at || now,
      },
      api: {
        connected: ch.status === "connected",
        last_check: ch.updated_at || now,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
