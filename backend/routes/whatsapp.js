import { Router } from 'express';
import { sendWhatsApp, sendTemplateMeta, PROVIDER } from '../services/whatsapp.js';

const router = Router();

router.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body || {};
    if (!to || !message) return res.status(400).json({ error: 'missing_to_or_message' });
    const r = await sendWhatsApp(to, message);
    res.json({ ok: true, provider: PROVIDER, result: r });
  } catch (e) {
    console.error('whatsapp send error', e.message);
    res.status(500).json({ error: 'whatsapp_send_failed', details: e.message });
  }
});

router.post('/send-template', async (req, res) => {
  try {
    const { to, template, language = 'pt_BR', components = [] } = req.body || {};
    if (!to || !template) return res.status(400).json({ error: 'missing_to_or_template' });
    const r = await sendTemplateMeta(to, template, language, components);
    res.json({ ok: true, provider: 'meta', result: r });
  } catch (e) {
    console.error('whatsapp template error', e.message);
    res.status(500).json({ error: 'whatsapp_template_failed', details: e.message });
  }
});

export default router;
