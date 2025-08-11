import makeWASocket from '@whiskeysockets/baileys';.default;
import { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';

let sock = null;
let qrDataURL = null;
let isConnected = false;
let currentSessionId = 'default';

async function createSession(sessionId = 'default') {
  currentSessionId = sessionId;
  const { state, saveCreds } = await useMultiFileAuthState(`./.wpp_auth/${sessionId}`);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['CresceJa', 'Chrome', '1.0'],
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrDataURL = await qrcode.toDataURL(qr);
    }
    if (connection === 'open') {
      isConnected = true;
      qrDataURL = null;
      console.log('[WPP] Conectado');
    }
    if (connection === 'close') {
      isConnected = false;
      const code = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log('[WPP] Conexão fechada. Reconnect?', shouldReconnect, 'code=', code);
      if (shouldReconnect) {
        setTimeout(() => createSession(sessionId), 2000);
      }
    }
  });

  return sock;
}

function getStatus() {
  return { isConnected, hasQR: !!qrDataURL, sessionId: currentSessionId };
}
function getQR() {
  return qrDataURL;
}

async function logout() {
  try {
    if (sock?.logout) await sock.logout();
    isConnected = false;
    qrDataURL = null;
    return { ok: true };
  } catch (e) {
    console.error('logout error', e);
    return { ok: false, error: 'Falha ao sair' };
  }
}

async function sendText(to, message) {
  if (!sock) throw new Error('Sessão não iniciada');
  const jid = to.includes('@s.whatsapp.net') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;  
  await sock.sendMessage(jid, { text: message });
  return { ok: true };
}

export default { createSession, getStatus, getQR, logout, sendText };
