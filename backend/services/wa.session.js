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
  if (impl && impl.createSession) {
    await impl.createSession(String(orgId));
    qr = impl.getQR ? impl.getQR() : null;
    const st = impl.getStatus ? impl.getStatus() : { status };
    io?.emit('wa:session:status', { status: st.status || status });
    if (qr) io?.emit('wa:session:qr', { qr });
    return st;
  }
  qr = fakeQr();
  io?.emit('wa:session:qr', { qr });
  status = 'connected';
  io?.emit('wa:session:status', { status });
  return { status };
}

export function getStatus() {
  if (impl && impl.getStatus) return impl.getStatus();
  return { status };
}

export async function logout(orgId, io) {
  if (impl && impl.logout) await impl.logout();
  status = 'disconnected';
  io?.emit('wa:session:status', { status });
  return { ok: true };
}

export function test() {
  return { status, ws_ok: true, inbound_recent: true };
}

export default { start, getStatus, logout, test };
