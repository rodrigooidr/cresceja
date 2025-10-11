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
    listeners: new Set(),
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
  for (const handler of [...session.listeners]) {
    try {
      handler(payload);
    } catch (err) {
      session.listeners.delete(handler);
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

function subscribeToSession(orgId, handler) {
  const session = ensureSession(orgId);
  session.listeners.add(handler);
  return () => {
    session.listeners.delete(handler);
  };
}

export function subscribe(orgId, res) {
  const session = ensureSession(orgId);
  let closed = false;

  const send = (payload) => {
    if (closed) return;
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      closed = true;
      unsubscribe();
      try {
        res.end();
      } catch {}
    }
  };

  const unsubscribe = subscribeToSession(orgId, send);

  if (session.lastQr) {
    send({ type: 'qr', qr: { raw: session.lastQr.raw, dataUrl: session.lastQr.dataUrl } });
  }
  send({ type: 'status', status: session.status });

  return () => {
    if (closed) return;
    closed = true;
    unsubscribe();
  };
}

export async function startBaileysQrStream({
  orgId,
  sessionId: _sessionId,
  onQr,
  onStatus,
  onError,
  onConnected,
}) {
  if (!orgId) {
    throw new Error('org_id_required');
  }

  const session = ensureSession(orgId);
  const emitQr = typeof onQr === 'function' ? onQr : null;
  const emitStatus = typeof onStatus === 'function' ? onStatus : null;
  const emitError = typeof onError === 'function' ? onError : null;
  const emitConnected = typeof onConnected === 'function' ? onConnected : null;

  if (session.lastQr && emitQr) {
    const data = session.lastQr.dataUrl || session.lastQr.raw;
    if (data) emitQr(data);
  }
  if (emitStatus) {
    emitStatus(session.status);
  }
  if (session.status === 'connected' && emitConnected) {
    emitConnected();
  }

  const handler = (payload) => {
    try {
      if (!payload || typeof payload !== 'object') return;
      if (payload.type === 'qr' && payload.qr && emitQr) {
        const value =
          typeof payload.qr === 'string'
            ? payload.qr
            : payload.qr.dataUrl || payload.qr.raw || null;
        if (value) emitQr(value);
      } else if (payload.type === 'status' && emitStatus) {
        emitStatus(payload.status);
        if (payload.status === 'connected' && emitConnected) {
          emitConnected();
        }
      } else if (payload.type === 'error' && emitError) {
        const err =
          payload.error instanceof Error
            ? payload.error
            : new Error(payload.message || 'baileys_stream_error');
        emitError(err);
      }
    } catch (err) {
      if (emitError) {
        emitError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const unsubscribe = subscribeToSession(orgId, handler);
  return () => {
    unsubscribe();
  };
}

export { ensureSession };
