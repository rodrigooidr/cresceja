// routes/integrations/index.js
import { Router } from "express";
import pino from "pino";
import {
  authRequired,
  orgScope,
  authenticate,
  requireWhatsAppQrPermission,
} from "../../middleware/auth.js";
import { requireAnyRole, requireOrgFeature } from "../../middlewares/auth.js";
import { diagFeatureLog } from "../../middlewares/diagFeatureLog.js";
import { attachOrgFromHeader } from "../../middlewares/orgContext.js";
import whatsappCloud from "../integrations/whatsapp.cloud.js";
import metaOauthRouter from "../integrations/meta.oauth.js";
import googleCalendarRouter from "../integrations/google.calendar.js";
import { Pool } from "pg";
import { signQrToken } from "../../services/qrToken.js";
import { setConnected as markConnected } from "../../services/baileys.session.js";
import { startBaileysQrStream } from "../../services/whatsapp/baileysSession.js";

const r = Router();
const log = pino({ level: process.env.WA_LOG_LEVEL ?? "info" });

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

// ========= ROTA PÚBLICA (ANTES do authRequired) =========
// Stream SSE do QR/pings protegido por JWT com scope whatsapp_qr
r.get(
  "/providers/whatsapp_session/qr/stream",
  authenticate,
  requireWhatsAppQrPermission,
  diagFeatureLog("whatsapp_session_enabled"),
  requireWhatsAppSessionFeature,
  async (req, res) => {
    const orgId =
      req.auth?.org_id ||
      req.org?.id ||
      req.orgId ||
      (typeof req.headers["x-org-id"] === "string" ? req.headers["x-org-id"] : null) ||
      (typeof req.query?.orgId === "string" ? req.query.orgId : null);

    if (!orgId) {
      return res.status(400).json({ error: "invalid_org", message: "Org ausente" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sessionId = String(req.query?.sessionId ?? "default");
    const cid = Math.random().toString(36).slice(2, 8);
    LOG_QR(`OPEN cid=${cid} org=${orgId} session=${sessionId}`);

    let closed = false;
    let stop;
    let pingTimer;

    const cleanup = () => {
      if (pingTimer) clearInterval(pingTimer);
      try {
        const maybe = stop?.();
        if (maybe && typeof maybe.then === "function") {
          maybe.catch(() => {});
        }
      } catch {}
      try {
        res.end();
      } catch {}
    };

    const writeEvent = (event, payload) => {
      if (closed) return;
      if (
        process.env.LOG_QR_STREAM === "1" &&
        event &&
        !["qr", "status", "connected", "error"].includes(event)
      ) {
        LOG_QR(`EMIT ${event} cid=${cid}`);
      }
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(payload ?? {})}\n\n`);
      } catch {
        handleClose();
      }
    };

    try {
      stop = await startBaileysQrStream({
        orgId: String(orgId),
        sessionId,
        onQr: (qr) => {
          if (!qr) return;
          const value = typeof qr === "string" ? qr : String(qr);
          if (process.env.LOG_QR_STREAM === "1") {
            LOG_QR(`EMIT qr len=${value.length} cid=${cid}`);
          }
          writeEvent("qr", { qr: value });
        },
        onStatus: (status) => {
          if (!status) return;
          if (process.env.LOG_QR_STREAM === "1") {
            LOG_QR(`EMIT status=${status} cid=${cid}`);
          }
          writeEvent("status", { status });
        },
        onError: (err) => {
          const message = err?.message || String(err || "unknown_error");
          LOG_QR(`EMIT error="${message}" cid=${cid}`);
          writeEvent("error", { message });
        },
        onConnected: () => {
          if (process.env.LOG_QR_STREAM === "1") {
            LOG_QR(`EMIT connected cid=${cid}`);
          }
          writeEvent("connected", {});
        },
      });
    } catch (err) {
      writeEvent("error", { message: err?.message || "failed_to_start_qr_stream" });
      handleClose();
      return;
    }

    pingTimer = setInterval(() => writeEvent("ping", { ts: Date.now() }), 15000);

    req.on("close", handleClose);

    function handleClose() {
      if (closed) return;
      closed = true;
      LOG_QR(`CLOSE cid=${cid}`);
      cleanup();
    }

    function LOG_QR(msg) {
      log.info({ class: "SSE[QR]" }, msg);
    }
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
    const primaryRole = req.user?.role ? String(req.user.role) : null;
    const roleList = Array.isArray(req.user?.roles)
      ? req.user.roles.map((role) => String(role))
      : [];
    const roles = Array.from(new Set([...(primaryRole ? [primaryRole] : []), ...roleList]));
    const token = signQrToken({
      userId,
      orgId,
      secret: process.env.JWT_SECRET,
      ttl: 60,
      role: primaryRole || roles[0],
      roles: roles.length ? roles : undefined,
    });
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
