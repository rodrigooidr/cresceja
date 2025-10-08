import { randomBytes } from 'crypto';

let impl = null;
try {
  const mod = await import('./whatsappSession.js');
  impl = mod?.default || mod;
} catch {
  impl = null;
}

let status = 'disconnected';

function fakeQr() {
  const buf = randomBytes(10).toString('hex');
  return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
}

export async function start(orgId, io) {
  status = 'connecting';
  let qr = null;

  if (impl) {
    const startFn = typeof impl.start === 'function'
      ? (ioRef) => impl.start(ioRef)
      : typeof impl.createSession === 'function'
        ? () => impl.createSession(String(orgId))
        : null;

    if (startFn) {
      await startFn(io);
      const st = typeof impl.status === 'function'
        ? impl.status()
        : typeof impl.getStatus === 'function'
          ? impl.getStatus()
          : { status };
      status = st.status || status;

      if (typeof impl.start !== 'function' && io) {
        io.emit('wa:session:status', { status });
      }

      qr = typeof impl.getQR === 'function' ? impl.getQR() : null;
      if (qr && typeof impl.start !== 'function') {
        io?.emit('wa:session:qr', { qr });
      }

      return st;
    }
  }

  qr = fakeQr();
  io?.emit('wa:session:qr', { qr });
  status = 'connected';
  io?.emit('wa:session:status', { status });
  return { status, hasQR: true };
}

export function getStatus() {
  if (impl) {
    if (typeof impl.status === 'function') return impl.status();
    if (typeof impl.getStatus === 'function') return impl.getStatus();
  }
  return { status };
}

export async function logout(orgId, io) {
  if (impl && typeof impl.logout === 'function') await impl.logout(orgId, io);
  status = 'disconnected';
  io?.emit('wa:session:status', { status });
  return { ok: true };
}

export function test() {
  return { status, ws_ok: true, inbound_recent: true };
}

export default { start, getStatus, logout, test };
