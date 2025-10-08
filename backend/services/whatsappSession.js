import path from 'path';
import fs from 'fs';
import qrcode from 'qrcode';
import state from './wa.state.js';

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';

let sock;
let ioRef;

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

async function init(io) {
  ioRef = io;
  state.setStatus('connecting');

  const authDir = process.env.WPP_SESSION_DIR
    ? path.resolve(process.cwd(), process.env.WPP_SESSION_DIR)
    : path.resolve(process.cwd(), '.wpp_auth');
  await ensureDir(authDir);

  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: false,
    syncFullHistory: false,
    browser: ['CresceJa', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      const dataUrl = await qrcode.toDataURL(qr);
      state.setQR(dataUrl);
      ioRef?.emit('wa:session:qr', { dataUrl });
    }

    if (connection === 'open') {
      state.setStatus('connected');
      state.clearQR();
      ioRef?.emit('wa:session:status', { status: 'connected' });
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      state.setStatus('disconnected');
      ioRef?.emit('wa:session:status', { status: 'disconnected' });
      if (shouldReconnect) setTimeout(() => init(ioRef), 2000);
    }
  });

  return sock;
}

function start(io) {
  if (!sock) return init(io);
  return sock;
}

function status() {
  return { status: state.getStatus(), hasQR: !!state.getQR() };
}

function getQR() {
  return state.getQR();
}

export { start, status, getQR };
export default { start, status, getQR };
