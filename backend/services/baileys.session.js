import QRCode from 'qrcode';

const sessions = new Map();

function getSession(orgId) {
  return sessions.get(orgId);
}

function createSession(orgId) {
  const session = {
    status: 'pending_qr',
    lastQr: null,
    timer: null,
    subscribers: new Set(),
  };
  sessions.set(orgId, session);
  return session;
}

function ensureSession(orgId) {
  return getSession(orgId) || createSession(orgId);
}

async function generateQrDataUrl(text) {
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 256 });
  } catch {
    return null;
  }
}

function emit(orgId, payload) {
  const session = getSession(orgId);
  if (!session) return;
  for (const res of session.subscribers) {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      session.subscribers.delete(res);
      try {
        res.end();
      } catch {}
    }
  }
}

async function emitQr(orgId) {
  const session = ensureSession(orgId);
  const raw = `baileys:${orgId}:${Date.now()}`;
  const dataUrl = await generateQrDataUrl(raw);
  session.lastQr = { raw, dataUrl, at: Date.now() };
  session.status = 'pending_qr';
  emit(orgId, { type: 'qr', qr: { raw, dataUrl } });
  emit(orgId, { type: 'status', status: session.status });
}

export function startQrLoop(orgId) {
  const session = ensureSession(orgId);
  if (session.timer) {
    clearInterval(session.timer);
  }
  session.status = 'pending_qr';
  session.timer = setInterval(() => {
    emitQr(orgId).catch(() => {});
  }, 20000);
  emitQr(orgId).catch(() => {});
  return session;
}

export function stopQrLoop(orgId) {
  const session = getSession(orgId);
  if (!session) return;
  if (session.timer) {
    clearInterval(session.timer);
    session.timer = null;
  }
}

export function setConnected(orgId) {
  const session = ensureSession(orgId);
  session.status = 'connected';
  if (session.timer) {
    clearInterval(session.timer);
    session.timer = null;
  }
  emit(orgId, { type: 'status', status: 'connected' });
}

export function getStatus(orgId) {
  const session = ensureSession(orgId);
  return {
    status: session.status,
    lastQr: session.lastQr,
  };
}

export function subscribe(orgId, res) {
  const session = ensureSession(orgId);
  session.subscribers.add(res);
  if (session.lastQr) {
    res.write(`data: ${JSON.stringify({ type: 'qr', qr: { raw: session.lastQr.raw, dataUrl: session.lastQr.dataUrl } })}\n\n`);
  }
  res.write(`data: ${JSON.stringify({ type: 'status', status: session.status })}\n\n`);
  return () => {
    session.subscribers.delete(res);
  };
}

export { ensureSession };
