import { Router } from 'express';
import Joi from 'joi';
import { query } from '#db';
import * as authModule from '../middleware/auth.js';

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

router.use(requireAuth);

router.get('/crm/contact/by-phone', async (req, res, next) => {
  try {
    const phone = String(req.query.phone ?? '').trim();
    const orgId = req.user?.org_id || req.get('X-Org-Id');
    if (!phone || !orgId) {
      return res.status(400).json({ error: 'phone_and_org_required' });
    }

    const sql = `
      SELECT c.*,
             ARRAY(
               SELECT t.name
               FROM public.contact_tags ct
               JOIN public.tags t ON t.id = ct.tag_id AND t.org_id = c.org_id
               WHERE ct.contact_id = c.id AND ct.org_id = c.org_id
               ORDER BY t.name
             ) AS tags
      FROM public.contacts c
      WHERE c.org_id = $1
        AND EXISTS (
          SELECT 1 FROM public.contact_identities ci
          WHERE ci.org_id = c.org_id
            AND ci.contact_id = c.id
            AND ci.channel = 'whatsapp'
            AND ci.identity = $2
        )
      LIMIT 1
    `;

    const { rows } = await query(sql, [orgId, phone]);
    res.json({ contact: rows[0] || null });
  } catch (err) {
    next(err);
  }
});

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  phone_e164: Joi.string().pattern(/^\+?\d{8,15}$/).required(),
  email: Joi.string().email().required(),
  birthdate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
});

router.post('/crm/contact', async (req, res, next) => {
  try {
    const orgId = req.user?.org_id || req.get('X-Org-Id');
    const { error, value } = createSchema.validate(req.body ?? {}, { abortEarly: false });
    if (!orgId) {
      return res.status(400).json({ error: 'org_required' });
    }
    if (error) {
      return res.status(400).json({ error: 'validation', details: error.details });
    }

    const insertContact = await query(
      `INSERT INTO public.contacts (id, org_id, name, email, birthdate, phone_e164, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now(), now())
       RETURNING *`,
      [orgId, value.name, value.email, value.birthdate, value.phone_e164]
    );
    const contact = insertContact.rows[0];

    await query(
      `INSERT INTO public.contact_identities (id, org_id, channel, account_id, identity, contact_id, created_at)
       VALUES (gen_random_uuid(), $1, 'whatsapp', NULL, $2, $3, now())`,
      [orgId, value.phone_e164, contact.id]
    );

    res.json({ ok: true, contact });
  } catch (err) {
    next(err);
  }
});

router.post('/crm/contact/:id/tags', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tag } = req.body ?? {};
    const orgId = req.user?.org_id || req.get('X-Org-Id');

    if (!tag || !orgId) {
      return res.status(400).json({ error: 'tag_and_org_required' });
    }

    let tagId;
    const existing = await query(
      `SELECT id FROM public.tags WHERE org_id = $1 AND lower(name) = lower($2) LIMIT 1`,
      [orgId, tag]
    );
    tagId = existing.rows[0]?.id;

    if (!tagId) {
      const inserted = await query(
        `INSERT INTO public.tags (id, org_id, name)
         VALUES (gen_random_uuid(), $1, $2)
         RETURNING id`,
        [orgId, tag]
      );
      tagId = inserted.rows[0].id;
    }

    await query(
      `INSERT INTO public.contact_tags (contact_id, tag_id, org_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [id, tagId, orgId]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/crm/tags', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    const orgId = req.user?.org_id || req.get('X-Org-Id');
    if (!orgId) {
      return res.status(400).json({ error: 'org_required' });
    }

    const args = [orgId];
    let sql = `SELECT name FROM public.tags WHERE org_id = $1`;
    if (q) {
      args.push(`%${q}%`);
      sql += ` AND name ILIKE $2`;
    }
    sql += ` ORDER BY name LIMIT 50`;

    const { rows } = await query(sql, args);
    res.json({ items: rows.map((r) => r.name) });
  } catch (err) {
    next(err);
  }
});

export default router;
