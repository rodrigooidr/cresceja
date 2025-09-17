// ADD-ONLY: compat layer para expor endpoints esperados pelo novo frontend
// Sem deletar/alterar nada do que já existe.

const express = require('express');

// ⬇️ Ajuste esses requires para os seus middlewares reais (RBAC/Org/Auth)
const requireAuth = require('../middleware/auth')?.requireAuth || ((_req,_res,next)=>next());
const rbac        = require('../middleware/rbac')?.requireRole || ((_role)=>((_req,_res,next)=>next()));

// ⬇️ Reuse sua infra existente, se tiver:
let io = null;
try { io = require('../socket/io').io; } catch { /* opcional */ }

let pool = null;
try { pool = require('../db').pool || require('../config/db').pool; } catch { /* opcional */ }
if (!pool) {
  // fallback leve; NÃO quebra seu app se você já tem pool centralizado.
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

// Util helpers mínimos (evita duplicar lógica existente)
// Se já tiver serviços equivalentes, você pode trocar os requires abaixo:
const { withIdempotency } = require('../addons/inbox-lite/services/idempotency');
const Hist = require('../addons/inbox-lite/services/history');
const CRM  = require('../addons/inbox-lite/services/crm');
const AI   = require('../addons/inbox-lite/services/ai');
const Audit= require('../addons/inbox-lite/services/audit');

// Emite no seu Socket.IO se existir
function emit(event, payload){ try { io?.emit?.(event, payload); } catch(_){} }

const api = express.Router();

// -------- WhatsApp (Cloud/Baileys) --------
function makeWhatsAppRouter(transport){
  const r = express.Router();

  r.post('/send', requireAuth, rbac('inbox:send'), async (req,res)=>{
    const { to, text, chatId } = req.body || {};
    const key = req.get('Idempotency-Key');
    const out = await withIdempotency(pool, key, async () => {
      const conv = await Hist.ensureConversation(pool, chatId || to, transport);
      const msg  = await Hist.appendMessage(pool, conv.id, {
        direction:'out', type:'text', text, status:'sent'
      });
      emit('wa:message', { id:`srv-${msg.id}`, chatId: chatId||to, from:'me', to, direction:'out', type:'text', text, status:'sent', timestamp:Date.now() });
      return { ok:true, message:{ id:`srv-${msg.id}`, chatId: chatId||to, type:'text', text, status:'sent' }, idempotency:key||null };
    });
    res.json(out);
  });

  r.post('/sendMedia', requireAuth, rbac('inbox:send'), async (req,res)=>{
    const { to, media, caption, chatId } = req.body || {};
    const key = req.get('Idempotency-Key');
    const out = await withIdempotency(pool, key, async () => {
      const conv = await Hist.ensureConversation(pool, chatId || to, transport);
      const msg  = await Hist.appendMessage(pool, conv.id, {
        direction:'out', type: media?.type||'image', text: caption||'',
        media_url: media?.url, media_mime: media?.mime, media_filename: media?.filename, status:'sent'
      });
      emit('wa:message', { id:`srv-${msg.id}`, chatId: chatId||to, from:'me', to, direction:'out', type: media?.type||'image', text: caption||'', media, status:'sent', timestamp:Date.now() });
      return { ok:true, message:{ id:`srv-${msg.id}`, chatId: chatId||to, type: media?.type||'image', text: caption||'', status:'sent' }, idempotency:key||null };
    });
    res.json(out);
  });

  r.post('/markRead', requireAuth, rbac('inbox:read'), async (req,res)=>{
    const { chatId, messageId } = req.body || {};
    emit('wa:status', { chatId, messageId, status:'read', timestamp:Date.now() });
    res.json({ ok:true });
  });

  r.post('/typing', requireAuth, async (req,res)=>{
    const { chatId, state } = req.body || {};
    emit('wa:typing', { chatId, from:chatId, state: state||'composing', timestamp:Date.now() });
    res.json({ ok:true });
  });

  r.get('/history', requireAuth, rbac('inbox:view'), async (req,res)=>{
    const { chatId } = req.query;
    const { rows } = await pool.query(
      `SELECT m.* FROM public.messages m
       JOIN public.conversations c ON c.id = m.conversation_id
       WHERE c.chat_id=$1 AND c.transport=$2
       ORDER BY m.created_at ASC
       LIMIT $3`, [chatId, transport, Number(req.query.limit||20)]
    );
    const items = rows.map(r => ({
      id:`srv-${r.id}`, chatId,
      from: r.direction==='in'?chatId:'me',
      to: r.direction==='out'?chatId:'me',
      direction:r.direction, type:r.type, text:r.text,
      media: r.media_url ? { url:r.media_url, mime:r.media_mime, filename:r.media_filename, type:r.type } : null,
      timestamp: new Date(r.created_at).getTime(), status:r.status
    }));
    res.json({ items, nextCursor:null });
  });

  return r;
}

api.use('/whatsapp/cloud',   makeWhatsAppRouter('cloud'));
api.use('/whatsapp/baileys', makeWhatsAppRouter('baileys'));

// -------- CRM (reaproveita suas tabelas) --------
const Joi = require('joi');
const schemaContact = Joi.object({
  name: Joi.string().min(2).required(),
  phone: Joi.string().pattern(/^\+?\d{8,15}$/).required(),
  email: Joi.string().email().required(),
  birthday: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  status: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
  channel: Joi.string().valid('whatsapp','instagram','facebook').default('whatsapp')
});

api.get('/crm/contacts', requireAuth, rbac('crm:view'), async (req,res)=>{
  const phone = req.query?.phone, id = req.query?.id;
  if (phone) return res.json({ found: !!(await CRM.getByPhone(pool, phone)), contact: await CRM.getByPhone(pool, phone) });
  if (id)    return res.json({ contact: (await pool.query('SELECT * FROM contacts WHERE id=$1',[id])).rows[0] || null });
  return res.json({ items: (await pool.query('SELECT * FROM contacts')).rows });
});

api.post('/crm/contacts', requireAuth, rbac('crm:edit'), async (req,res)=>{
  const { error, value } = schemaContact.validate(req.body||{}, { abortEarly:false });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok:true, contact: await CRM.createContact(pool, value) });
});

api.post('/crm/update', requireAuth, rbac('crm:edit'), async (req,res)=>{
  const { id, patch } = req.body||{};
  if (!id || !patch) return res.status(400).json({ error:'id/patch required' });
  res.json({ ok:true, contact: await CRM.updateContact(pool, Number(id), patch) });
});

api.post('/crm/tags', requireAuth, rbac('crm:edit'), async (req,res)=>{
  const { id, tag } = req.body||{};
  if (!id || !tag) return res.status(400).json({ error:'id/tag required' });
  res.json({ ok:true, contact: await CRM.addTag(pool, Number(id), tag) });
});

api.get('/crm/statuses', requireAuth, async (_req,res)=> res.json({ items: CRM.listStatuses() }));

// -------- AI (global e por chat) --------
api.get('/ai/settings', requireAuth, rbac('ai:view'), async (_req,res)=> res.json({ enabledAll: await AI.getGlobal(pool) }));
api.post('/ai/settings', requireAuth, rbac('ai:edit'), async (req,res)=> { await AI.setGlobal(pool, !!req.body?.enabledAll); res.json({ ok:true }); });
api.get('/ai/perChat', requireAuth, rbac('ai:view'), async (req,res)=> res.json({ enabled: await AI.getPerChat(pool, req.query.chatId) }));
api.post('/ai/perChat', requireAuth, rbac('ai:edit'), async (req,res)=> { await AI.setPerChat(pool, req.body?.chatId, !!req.body?.enabled); res.json({ ok:true }); });

// -------- Governança & Logs --------
api.post('/gov/logs', requireAuth, rbac('audit:write'), async (req,res)=> { await Audit.log(pool, req.body?.event, req.body?.payload||null, req.body?.actor||null); res.json({ ok:true }); });
api.get('/gov/logs',  requireAuth, rbac('audit:view'),  async (req,res)=> res.json({ items: await Audit.list(pool, req.query.event, Number(req.query.limit||100)) }));

module.exports = api;
