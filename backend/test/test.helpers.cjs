import express from 'express';

const USERS = {
  orgAdmin: {
    id: 'user-admin',
    org_id: 'org-1',
    orgId: 'org-1',
    role: 'OrgAdmin',
    email: 'admin@example.com',
    roles: [],
  },
  user: {
    id: 'user-regular',
    org_id: 'org-1',
    orgId: 'org-1',
    role: 'OrgViewer',
    email: 'user@example.com',
    roles: [],
  },
  superAdmin: {
    id: 'user-super',
    org_id: 'org-1',
    orgId: 'org-1',
    role: 'OrgOwner',
    email: 'super@example.com',
    roles: ['SuperAdmin'],
  },
};

function createInitialEvents() {
  const now = Date.now();
  return [
    { id: 'evt-noshow-1', start_at: new Date(now - 60 * 60 * 1000).toISOString(), rsvp_status: 'pending', canceled_at: null },
    { id: 'evt-noshow-2', start_at: new Date(now - 30 * 60 * 1000).toISOString(), rsvp_status: 'pending', canceled_at: null },
    { id: 'evt-noshow-3', start_at: new Date(now + 60 * 60 * 1000).toISOString(), rsvp_status: 'pending', canceled_at: null },
  ];
}

const state = {
  reminderLogs: new Map(),
  auditLogs: [],
  events: createInitialEvents(),
};

function resetDb() {
  state.reminderLogs.clear();
  state.auditLogs.length = 0;
  state.events = createInitialEvents();
  if (typeof db.query.mockClear === 'function') {
    db.query.mockClear();
  }
}

function handleReminderInsert(params = []) {
  const [eventId, channel, recipient, hash] = params;
  if (state.reminderLogs.has(hash)) {
    const err = new Error('duplicate key value violates unique constraint');
    err.code = '23505';
    throw err;
  }
  const record = { event_id: eventId, channel, recipient, hash };
  state.reminderLogs.set(hash, record);
  return { rows: [record], rowCount: 1 };
}

function handleAuditInsert(params = []) {
  const [orgId, userId, action, entity, entityId, payload] = params;
  const entry = { orgId, userId, action, entity, entityId, payload };
  state.auditLogs.push(entry);
  return { rows: [entry], rowCount: 1 };
}

function handleAuditInsertByEmail(params = []) {
  const [userEmail, action, entity, entityId, payload] = params;
  const entry = { userEmail, action, entity, entityId, payload };
  state.auditLogs.push(entry);
  return { rows: [entry], rowCount: 1 };
}

function handleReminderUpdate() {
  return { rows: [], rowCount: 1 };
}

function handleNoShowUpdate(params = []) {
  const [minutesRaw] = params;
  const minutes = Number.isFinite(Number(minutesRaw)) ? Number(minutesRaw) : 0;
  const threshold = Date.now() - minutes * 60 * 1000;
  const updated = [];
  state.events.forEach((event) => {
    const startAt = new Date(event.start_at).getTime();
    if (
      event.rsvp_status === 'pending' &&
      !event.canceled_at &&
      Number.isFinite(startAt) &&
      startAt < threshold
    ) {
      event.rsvp_status = 'noshow';
      event.noshow_at = new Date().toISOString();
      updated.push({ id: event.id });
    }
  });
  return { rows: updated, rowCount: updated.length };
}

const query = jest.fn(async (sql, params = []) => {
  const text = String(sql).toLowerCase();
  if (text.includes('insert into reminder_logs')) {
    return handleReminderInsert(params);
  }
  if (text.includes('insert into audit_logs (org_id')) {
    return handleAuditInsert(params);
  }
  if (text.includes('insert into audit_logs (user_email')) {
    return handleAuditInsertByEmail(params);
  }
  if (text.includes('update public.calendar_events set reminder_sent_at')) {
    return handleReminderUpdate(params);
  }
  if (text.includes("update public.calendar_events") && text.includes("rsvp_status = 'noshow'")) {
    return handleNoShowUpdate(params);
  }
  return { rows: [], rowCount: 0 };
});

const db = { query };

function customRequireAuth(req, res, next) {
  const auth = req.headers?.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
  const token = auth.replace(/^Bearer\s*/i, '').trim();
  const user = USERS[token];
  if (!user) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  req.user = { ...user };
  req.orgId = user.org_id;
  return next();
}

function customRequireRole(superAdminRole, orgAdminRole) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }
    if (role === superAdminRole || role === orgAdminRole) {
      return next();
    }
    return res.status(403).json({ error: 'FORBIDDEN' });
  };
}

function authHeaderFor({ role = 'user' } = {}) {
  return { Authorization: `Bearer ${role}` };
}

async function makeApp() {
  const { default: createRouter } = await import('../routes/calendar.reminders.one.js');
  const router = createRouter({
    db,
    requireAuth: customRequireAuth,
    requireRole: customRequireRole,
    ROLES: { OrgAdmin: 'OrgAdmin', SuperAdmin: 'SuperAdmin' },
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.db = db;
    next();
  });
  app.use(router);
  app.use((err, _req, res, _next) => {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || 'error' });
  });
  return app;
}

resetDb();

module.exports = {
  makeApp,
  db,
  state,
  resetDb,
  authHeaderFor,
};
