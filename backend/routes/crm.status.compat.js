import { Router } from 'express';
import { query } from '#db';
import * as authModule from '../middleware/auth.js';

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

router.use(requireAuth);

router.get('/crm/contact/:id/status', async (req, res, next) => {
  try {
    const contactId = req.params.id;
    const sql = `
      SELECT c.id AS contact_id, c.client_id, cl.status
        FROM public.contacts c
        LEFT JOIN public.clients cl ON cl.id = c.client_id
       WHERE c.id = $1
       LIMIT 1
    `;
    const { rows } = await query(sql, [contactId]);
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ error: 'contact_not_found' });
    }
    res.json({ contactId, clientId: row.client_id ?? null, status: row.status ?? null });
  } catch (err) {
    next(err);
  }
});

router.post('/crm/contact/:id/status', async (req, res, next) => {
  try {
    const contactId = req.params.id;
    const status = String(req.body?.status ?? '').trim();
    if (!status) {
      return res.status(400).json({ error: 'status_required' });
    }

    const contact = await query(`SELECT id, client_id FROM public.contacts WHERE id = $1`, [contactId]);
    if (!contact.rowCount) {
      return res.status(404).json({ error: 'contact_not_found' });
    }
    const clientId = contact.rows[0].client_id;
    if (!clientId) {
      return res.status(409).json({ error: 'contact_without_client', hint: 'create_client_first' });
    }

    await query(`UPDATE public.clients SET status = $2, updated_at = now() WHERE id = $1`, [clientId, status]);
    res.json({ ok: true, clientId, status });
  } catch (err) {
    next(err);
  }
});

router.get('/crm/contact/:id/profile', async (req, res, next) => {
  try {
    const id = req.params.id;
    const sql = `
      SELECT c.id AS contact_id, c.org_id, c.name, c.display_name, c.first_name,
             c.phone_e164, c.phone, c.email, c.birthdate, c.notes, c.client_id,
             cl.status AS client_status,
             ARRAY(
               SELECT t.name
                 FROM public.contact_tags ct
                 JOIN public.tags t ON t.id = ct.tag_id AND t.org_id = c.org_id
                WHERE ct.contact_id = c.id AND ct.org_id = c.org_id
                ORDER BY t.name
             ) AS tags
        FROM public.contacts c
        LEFT JOIN public.clients cl ON cl.id = c.client_id
       WHERE c.id = $1
       LIMIT 1
    `;
    const { rows } = await query(sql, [id]);
    const profile = rows[0];
    if (!profile) {
      return res.status(404).json({ error: 'contact_not_found' });
    }
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

export default router;
