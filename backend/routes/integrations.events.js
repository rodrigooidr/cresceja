import { Router } from 'express';
import { pool } from '#db';

const SENSITIVE_KEY_PATTERN = /(token|secret|key|credential|password|signature|bearer|auth)/i;
const REDACTED_VALUE = '[REDACTED]';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonLike(value) {
  if (value === null || value === undefined) return {};
  if (isPlainObject(value) || Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return isPlainObject(parsed) || Array.isArray(parsed) ? parsed : { value: parsed };
    } catch {
      return { value };
    }
  }
  return value;
}

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (isPlainObject(value)) {
    return Object.entries(value).reduce((acc, [key, current]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        acc[key] = REDACTED_VALUE;
        return acc;
      }
      acc[key] = sanitizeValue(current);
      return acc;
    }, {});
  }
  return value;
}

function sanitizePayload(rawPayload) {
  const parsed = parseJsonLike(rawPayload);
  const sanitized = sanitizeValue(parsed);
  return sanitized;
}

function deriveEventType(explicit, payload) {
  if (explicit && typeof explicit === 'string' && explicit.trim()) {
    return explicit;
  }
  const source = isPlainObject(payload) ? payload : {};
  const candidates = [
    source.event_type,
    source.type,
    source.status,
    source.action,
    source.object,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  const entryList = Array.isArray(source.entry) ? source.entry : [];
  for (const entry of entryList) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (typeof change?.field === 'string' && change.field.trim()) {
        return change.field;
      }
    }
  }
  return null;
}

function pickFirstString(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickFirstString(item);
      if (found) return found;
    }
    return null;
  }
  if (isPlainObject(value)) {
    const priorityKeys = ['summary', 'message', 'description', 'status', 'field'];
    for (const key of priorityKeys) {
      if (typeof value[key] === 'string' && value[key].trim()) {
        return value[key];
      }
    }
    if (value.text && typeof value.text.body === 'string') {
      return value.text.body;
    }
    if (value.messages && Array.isArray(value.messages)) {
      const fromMessages = pickFirstString(value.messages);
      if (fromMessages) return fromMessages;
    }
    if (value.changes && Array.isArray(value.changes)) {
      const fromChanges = pickFirstString(value.changes);
      if (fromChanges) return fromChanges;
    }
  }
  return null;
}

function deriveSummary(provider, eventType, payload) {
  const primary = pickFirstString(payload);
  if (primary && typeof primary === 'string') {
    const trimmed = primary.trim();
    if (trimmed) {
      return trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;
    }
  }
  if (eventType) {
    return eventType;
  }
  if (typeof payload === 'string' && payload.trim()) {
    const trimmed = payload.trim();
    return trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;
  }
  return `Evento ${provider}`;
}

function parseLimit(value) {
  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric) || numeric <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(numeric, MAX_LIMIT);
}

function parseOffset(value) {
  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
}

function parseDate(value) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function sanitizeEventRow(row) {
  const payload = sanitizePayload(row.payload);
  const eventType = deriveEventType(row.event_type, payload);
  const summary = deriveSummary(row.provider, eventType, payload);
  return {
    id: row.id,
    org_id: row.org_id,
    provider: row.provider,
    event_type: eventType,
    received_at: row.received_at instanceof Date ? row.received_at.toISOString() : new Date(row.received_at).toISOString(),
    summary,
    payload,
  };
}

export function createIntegrationsEventsRouter({ logger = console } = {}) {
  const router = Router();

  router.use((req, _res, next) => {
    if (!req.db) {
      req.db = pool;
    }
    if (!req.log) {
      req.log = logger;
    }
    next();
  });

  router.get('/events', async (req, res) => {
    const db = req.db || pool;
    const provider = typeof req.query.provider === 'string' && req.query.provider.trim() ? req.query.provider.trim() : null;
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const start = parseDate(req.query.start);
    const end = parseDate(req.query.end);

    const orgFromQuery = typeof req.query.orgId === 'string' && req.query.orgId.trim() ? req.query.orgId.trim() : null;
    const orgId = orgFromQuery || req.orgId || req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'org_required', message: 'OrgId obrigatório.' });
    }

    const conditions = ['org_id = $1'];
    const params = [orgId];

    if (provider) {
      params.push(provider);
      conditions.push(`provider = $${params.length}`);
    }
    if (start) {
      params.push(start.toISOString());
      conditions.push(`received_at >= $${params.length}`);
    }
    if (end) {
      params.push(end.toISOString());
      conditions.push(`received_at <= $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    try {
      const countQuery = `SELECT COUNT(*) AS total FROM integration_events WHERE ${whereClause}`;
      const dataQuery = `
        SELECT id, org_id, provider, event_type, payload, received_at
          FROM integration_events
         WHERE ${whereClause}
         ORDER BY received_at DESC
         LIMIT $${limitIndex}
         OFFSET $${offsetIndex}
      `;

      const [countResult, rowsResult] = await Promise.all([
        db.query(countQuery, params),
        db.query(dataQuery, [...params, limit, offset]),
      ]);

      const total = Number.parseInt(countResult.rows?.[0]?.total ?? '0', 10) || 0;
      const items = rowsResult.rows.map((row) => sanitizeEventRow(row));

      return res.json({ items, total });
    } catch (err) {
      req.log?.error?.(err, 'integration_events_list_failed');
      return res.status(500).json({
        error: 'list_events_failed',
        message: 'Falha ao listar eventos de integrações.',
      });
    }
  });

  return router;
}

export default createIntegrationsEventsRouter;
