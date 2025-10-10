// ESM + compat: prioriza export nomeado, depois tenta em default.makeWASocket
import * as BaileysNS from '@whiskeysockets/baileys';
import path from 'node:path';
import fs from 'node:fs';
import qrcode from 'qrcode';

const makeWASocket =
  BaileysNS.makeWASocket ?? BaileysNS.default?.makeWASocket;

const useMultiFileAuthState =
  BaileysNS.useMultiFileAuthState ?? BaileysNS.default?.useMultiFileAuthState;

const fetchLatestBaileysVersion =
  BaileysNS.fetchLatestBaileysVersion ?? BaileysNS.default?.fetchLatestBaileysVersion;

const DisconnectReason =
  BaileysNS.DisconnectReason ?? BaileysNS.default?.DisconnectReason;

const makeInMemoryStore =
  BaileysNS.makeInMemoryStore ?? BaileysNS.default?.makeInMemoryStore;

const Browsers =
  BaileysNS.Browsers ?? BaileysNS.default?.Browsers;

if (typeof makeWASocket !== 'function') {
  const keys = Object.keys(BaileysNS).join(', ');
  const dKeys = BaileysNS.default ? Object.keys(BaileysNS.default).join(', ') : '(no default)';
  throw new Error(`Baileys makeWASocket not found. exports=[${keys}] default=[${dKeys}]`);
}

const jidNormalizedUser =
  BaileysNS.jidNormalizedUser ??
  BaileysNS.default?.jidNormalizedUser ??
  ((jid) => jid);

let sock = null;
let ioRef = null;
let lastQRDataUrl = null;
let currentStatus = 'idle';

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}
function emitStatus(s) {
  currentStatus = s;
  if (ioRef) ioRef.emit('wa:session:status', { status: s });
}
function emitQR(dataUrl) {
  lastQRDataUrl = dataUrl;
  if (ioRef && dataUrl) ioRef.emit('wa:session:qr', { dataUrl });
}
function toJid(to) {
  if (!to) throw new Error('missing_to');
  if (to.includes('@')) return jidNormalizedUser(to);
  const digits = String(to).replace(/\D/g, '');
  if (!digits) throw new Error('invalid_to');
  return `${digits}@s.whatsapp.net`;
}

export async function createSession(io) {
  if (io) ioRef = io;

  const authDir = process.env.WPP_SESSION_DIR
    ? path.resolve(process.cwd(), process.env.WPP_SESSION_DIR)
    : path.resolve(process.cwd(), '.wpp_auth');
  await ensureDir(authDir);

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  // já conectado? retorna
  if (sock?.ws?.readyState === 1 && currentStatus === 'connected') return sock;

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    browser: ['CresceJa', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
    if (qr) {
      const dataUrl = await qrcode.toDataURL(qr);
      emitQR(dataUrl);
      emitStatus('pending');
    }
    if (connection === 'open') {
      emitStatus('connected');
      lastQRDataUrl = null;
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      emitStatus('disconnected');
      if (shouldReconnect) setTimeout(() => createSession(ioRef), 2000);
    }
  });

  // opcional: tratar recebidas
  sock.ev.on('messages.upsert', (_m) => {
    // integrar no Inbox se desejar
  });

  return sock;
}

export function getSessionStatus() {
  return { status: currentStatus, hasQR: !!lastQRDataUrl };
}

export function getSessionQR() {
  return lastQRDataUrl;
}

export async function logoutSessionService() {
  try {
    if (sock) {
      await sock.logout();
      emitStatus('logged_out');
      lastQRDataUrl = null;
    }
  } finally {
    sock = null;
  }
}

export async function sendTextMessage(to, text) {
  if (!sock) throw new Error('session_not_initialized');
  const jid = toJid(to);
  return sock.sendMessage(jid, { text: text ?? '' });
}
