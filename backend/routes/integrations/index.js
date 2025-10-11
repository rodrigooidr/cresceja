// routes/integrations/index.js
import { Router } from "express";
import { authRequired, orgScope } from "../../middleware/auth.js";
import { requireAnyRole, requireOrgFeature } from "../../middlewares/auth.js";
import { diagFeatureLog } from "../../middlewares/diagFeatureLog.js";
import { attachOrgFromHeader } from "../../middlewares/orgContext.js";
import whatsappCloud from "../integrations/whatsapp.cloud.js";
import metaOauthRouter from "../integrations/meta.oauth.js";
import googleCalendarRouter from "../integrations/google.calendar.js";
import { Pool } from "pg";
import { signQrToken, verifyQrToken } from "../../services/qrToken.js";
import { subscribe, setConnected as markConnected } from "../../services/baileys.session.js";

const r = Router();

// ========= Pool e injeta em req.db =========
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
});
r.use((req, _res, next) => { if (!req.db) req.db = pool; next(); });

// ========= Helpers =========
const requireWhatsAppSessionRole = requireAnyRole(["SuperAdmin", "OrgOwner"]);
const requireWhatsAppSessionFeature = requireOrgFeature("whatsapp_session_enabled");

function getQrTokenFromReq(req) {
  const hdrX = req.headers["x-qr-access-token"];
  const auth = req.headers.authorization || "";
  const fromAuthQR = auth.startsWith("QR ") ? auth.slice(3).trim() : null;
  const fromQuery = req.query?.access_token;
  // permitimos também Authorization: Bearer <QR> como fallback
  const fromAuthBearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  return String(hdrX || fromAuthQR || fromQuery || fromAuthBearer || "");
}

const allowQrTokenForStream = (req, res, next) => {
  const token = getQrTokenFromReq(req);

  // IMPORTANTE: como esta rota é pública (não passa por authRequired),
  // se não vier token curto, respondemos 401 aqui mesmo.
  if (!token) {
    return res.status(401).json({ error: "missing_token", message: "missing token" });
  }

  try {
    const payload = verifyQrToken(token, process.env.JWT_SECRET);
    req.user = { ...(req.user || {}), id: payload.sub, sub: payload.sub, roles: (req.user?.roles || []) };
    req.org  = { ...(req.org  || {}), id: payload.org_id };
    if (!req.orgId) req.orgId = payload.org_id;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "unauthorized", message: "Token QR inválido/expirado" });
  }
};

// ========= ROTA PÚBLICA (ANTES do authRequired) =========
// Stream SSE do QR/pings validado apenas pelo QR token curto
r.get(
  "/providers/whatsapp_session/qr/stream",
  attachOrgFromHeader,               // resolve orgId de header se vier
  allowQrTokenForStream,             // valida QR token curto
  diagFeatureLog("whatsapp_session_enabled"),
  requireWhatsAppSessionFeature,     // checa flag por orgId injetado pelo token
  (req, res) => {
    const orgId = req.org?.id || req.orgId || req.headers["x-org-id"];
    if (!orgId) {
      return res.status(400).json({ error: "invalid_org", message: "Org ausente" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const unsubscribe = subscribe(orgId, res);
    const ping = setInterval(() => {
      try { res.write(`event: ping\ndata: ${Date.now()}\n\n`); } catch {}
    }, 15000);

    req.on("close", () => {
      clearInterval(ping);
      unsubscribe();
      try { res.end(); } catch {}
    });
  }
);

// ========= A PARTIR DAQUI, TUDO AUTENTICADO =========
r.use(authRequired, orgScope);

// Status (usa função SQL)
r.get("/status", async (req, res) => {
  try {
    const orgId = req.orgId;
    if (!orgId) return res.status(400).json({ error: "missing_org", message: "orgId not resolved" });
    const { rows } = await pool.query("SELECT public.get_integrations_status($1) AS payload", [orgId]);
    const payload = rows?.[0]?.payload ?? null;
    return res.json(payload ?? { ok: true, whatsapp: [], other: [] });
  } catch (err) {
    req.log?.error?.({ err }, "integrations-status failed");
    return res.status(500).json({ error: "integrations_status_failed" });
  }
});

// Events simples
r.get("/events", async (_req, res) => res.json({ ok: true, items: [] }));

// QR: emitir token curto (requer auth e feature)
const issueQrToken = (req, res) => {
  const orgId = req.org?.id || req.orgId || req.headers["x-org-id"];
  const userId = req.user?.id || req.user?.sub || "unknown";
  if (!orgId) return res.status(400).json({ error: "invalid_org", message: "Org ausente" });
  try {
    const token = signQrToken({ userId, orgId, secret: process.env.JWT_SECRET, ttl: 60 });
    return res.json({ token, expires_in: 60 });
  } catch (err) {
    req.log?.error?.({ err }, "qr-token-sign-failed");
    return res.status(500).json({ error: "token_sign_failed", message: err.message });
  }
};

r.get(
  "/providers/whatsapp_session/qr/token",
  attachOrgFromHeader,
  requireWhatsAppSessionRole,
  diagFeatureLog("whatsapp_session_enabled"),
  requireWhatsAppSessionFeature,
  issueQrToken
);

r.post(
  "/providers/whatsapp_session/qr/start",
  attachOrgFromHeader,
  requireWhatsAppSessionRole,
  requireWhatsAppSessionFeature,
  (_req, res) => res.json({ ok: true })
);

r.post(
  "/providers/whatsapp_session/qr/stop",
  attachOrgFromHeader,
  requireWhatsAppSessionRole,
  requireWhatsAppSessionFeature,
  (_req, res) => res.json({ ok: true })
);

r.post(
  "/providers/whatsapp_session/mark-connected",
  attachOrgFromHeader,
  requireWhatsAppSessionRole,
  requireWhatsAppSessionFeature,
  (req, res) => {
    const orgId = req.org?.id || req.orgId || req.headers["x-org-id"];
    if (!orgId) return res.status(400).json({ error: "invalid_org", message: "Org ausente" });
    markConnected(orgId);
    return res.json({ ok: true });
  }
);

// ===== Demais provedores =====
r.use("/providers/whatsapp_cloud", whatsappCloud);
r.use("/providers/whatsapp-cloud", whatsappCloud);

r.use("/providers/meta_instagram", metaOauthRouter);
r.use("/providers/meta-instagram", metaOauthRouter);
r.use("/providers/meta_facebook", metaOauthRouter);
r.use("/providers/meta-facebook", metaOauthRouter);

const googleCalendarProvidersRouter = Router();
googleCalendarProvidersRouter.use((req, _res, next) => { req.url = `/integrations/google-calendar${req.url}`; next(); });
googleCalendarProvidersRouter.use(googleCalendarRouter);
r.use("/providers/google_calendar", googleCalendarProvidersRouter);
r.use("/providers/google-calendar", googleCalendarProvidersRouter);

export default r;
