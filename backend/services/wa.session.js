import { randomBytes } from 'crypto';

let impl = null;
try {
  // tenta usar serviço real se existir
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
  if (impl && impl.createSession) {
    await impl.createSession(String(orgId));
    const qr = impl.getQR ? impl.getQR() : null;
    if (qr) io?.to(`org:${orgId}`).emit('wa:qrcode', qr);
    return impl.getStatus ? impl.getStatus() : { status };
  }
  const qr = fakeQr();
  io?.to(`org:${orgId}`).emit('wa:qrcode', qr);
  status = 'connected';
  return { status };
}

export function getStatus() {
  if (impl && impl.getStatus) return impl.getStatus();
  return { status };
}

export async function logout() {
  if (impl && impl.logout) await impl.logout();
  status = 'disconnected';
  return { ok: true };
}

export default { start, getStatus, logout };
