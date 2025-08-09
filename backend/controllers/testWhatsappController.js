const { createSession, getStatus, getQR, logout, sendText } = require('../services/whatsappSession');
const { getOrCreateChannelForOwner } = require('../services/channelService');

let conversations = [];
let messages = [];
const genId = (p='id') => `${p}-${Date.now()}-${Math.floor(Math.random()*1e6)}`;

async function initSession(req, res) {
  try {
    await createSession('default');
    return res.json({ ok: true, status: getStatus(), qr: getQR() });
  } catch (e) {
    console.error('initSession error:', e);
    return res.status(500).json({ ok: false, error: 'Falha ao iniciar sessão' });
  }
}

async function getSessionStatus(req, res) {
  return res.json({ ok: true, status: getStatus(), qr: getQR() });
}

async function logoutSession(req, res) {
  const r = await logout();
  return res.json(r);
}

async function sendMessage(req, res) {
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

async function sendTestMessage(req, res) {
  const user = req.user;
  const { to, body } = req.body || {};
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  if (!to || !body) return res.status(400).json({ ok: false, error: 'Use { to, body }' });

  const companyId = user.company_id;
  const channelId = getOrCreateChannelForOwner(companyId);

  let conversation = conversations.find(c => c.customer_phone === to && c.channel_id === channelId);
  if (!conversation) {
    conversation = { id: genId('conv'), channel_id: channelId, company_id: companyId, customer_name: to, customer_phone: to, status: 'open', priority: 'normal', created_at: new Date() };
    conversations.push(conversation);
  }
  const msg = { id: genId('msg'), conversation_id: conversation.id, content: body, sender_type: 'agent', source_type: 'manual_test', created_at: new Date() };
  messages.push(msg);
  return res.json({ ok: true, conversation, msg });
}

async function receiveMessage(req, res) {
  const user = req.user;
  const { from, body } = req.body || {};
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  if (!from || !body) return res.status(400).json({ ok: false, error: 'Use { from, body }' });

  const companyId = user.company_id;
  const channelId = getOrCreateChannelForOwner(companyId);

  let conversation = conversations.find(c => c.customer_phone === from && c.channel_id === channelId);
  if (!conversation) {
    conversation = { id: genId('conv'), channel_id: channelId, company_id: companyId, customer_name: from, customer_phone: from, status: 'open', priority: 'normal', created_at: new Date() };
    conversations.push(conversation);
  }
  const msg = { id: genId('msg'), conversation_id: conversation.id, content: body, sender_type: 'customer', source_type: 'manual_test', created_at: new Date() };
  messages.push(msg);
  return res.json({ ok: true, conversation, msg });
}

module.exports = { initSession, getSessionStatus, logoutSession, sendMessage, sendTestMessage, receiveMessage };
