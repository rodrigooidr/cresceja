import {
  createSession,
  getStatus,
  getQR,
  logout,
  sendText,
} from '../services/whatsappSession.js';
import { getOrCreateChannelForOwner } from '../services/channelService.js';

const conversations = [];
const messages = [];
const genId = (p = 'id') => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const WARNING = '[\u26A0\uFE0F Ambiente de Teste - Modo Pessoal]';

export async function initSession(_req, res) {
  try {
    await createSession('default');
    return res.json({ ok: true, status: getStatus(), qr: getQR() });
  } catch (e) {
    console.error('initSession error:', e);
    return res.status(500).json({ ok: false, error: 'Falha ao iniciar sessão' });
  }
}

export function getSessionStatus(_req, res) {
  return res.json({ ok: true, status: getStatus(), qr: getQR() });
}

export async function logoutSession(_req, res) {
  const r = await logout();
  return res.json(r);
}

export async function sendMessage(req, res) {
  try {
    const { to, body } = req.body || {};
    if (!to || !body) return res.status(400).json({ ok: false, error: 'Use { to, body }' });
    await sendText(to, body);
    return res.json({ ok: true, message: 'Enviado via WhatsApp Web' });
  } catch (e) {
    console.error('sendMessage error:', e);
    return res.status(500).json({ ok: false, error: 'Falha ao enviar' });
  }
}

export function sendTestMessage(req, res) {
  const user = req.user;
  const { to, body } = req.body || {};
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  if (!to || !body) return res.status(400).json({ ok: false, error: 'Use { to, body }' });

  const companyId = user.company_id;
  const channelId = getOrCreateChannelForOwner(companyId);

  let conversation = conversations.find(
    (c) => c.customer_phone === to && c.channel_id === channelId
  );
  if (!conversation) {
    conversation = {
      id: genId('conv'),
      channel_id: channelId,
      company_id: companyId,
      customer_name: to,
      customer_phone: to,
      status: 'open',
      priority: 'normal',
      created_at: new Date(),
    };
    conversations.push(conversation);
  }
  const msg = {
    id: genId('msg'),
    conversation_id: conversation.id,
    content: `${WARNING} ${body}`,
    sender_type: 'agent',
    source_type: 'teste_manual',
    created_at: new Date(),
  };
  messages.push(msg);
  return res.json({ ok: true, conversation, msg });
}

export function receiveMessage(req, res) {
  const user = req.user;
  const { from, body } = req.body || {};
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  if (!from || !body) return res.status(400).json({ ok: false, error: 'Use { from, body }' });

  const companyId = user.company_id;
  const channelId = getOrCreateChannelForOwner(companyId);

  let conversation = conversations.find(
    (c) => c.customer_phone === from && c.channel_id === channelId
  );
  if (!conversation) {
    conversation = {
      id: genId('conv'),
      channel_id: channelId,
      company_id: companyId,
      customer_name: from,
      customer_phone: from,
      status: 'open',
      priority: 'normal',
      created_at: new Date(),
    };
    conversations.push(conversation);
  }
  const msg = {
    id: genId('msg'),
    conversation_id: conversation.id,
    content: `${WARNING} ${body}`,
    sender_type: 'customer',
    source_type: 'teste_manual',
    created_at: new Date(),
  };
  messages.push(msg);
  return res.json({ ok: true, conversation, msg });
}

export default {
  initSession,
  getSessionStatus,
  logoutSession,
  sendMessage,
  sendTestMessage,
  receiveMessage,
};

