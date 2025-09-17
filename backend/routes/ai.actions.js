import { Router } from 'express';
import { query } from '#db';
import Audit from '../services/audit.js';
import * as authModule from '../middleware/auth.js';

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

router.use(requireAuth);

router.post('/ai/actions/client.upsert', async (req, res, next) => {
  try {
    const {
      name,
      phone,
      email,
      birthdate,
      notes = null,
      tags = [],
      funnel_status: funnelStatus = null,
    } = req.body || {};

    if (!name || !phone || !email || !birthdate) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }

    const orgId = req.user?.org_id || '00000000-0000-0000-0000-000000000001';
    const found = await query(
      `
        SELECT id
          FROM public.contacts
         WHERE org_id = $1
           AND (phone_e164 = $2 OR phone = $2 OR email = $3)
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1
      `,
      [orgId, phone, email]
    );

    let id = found.rows[0]?.id || null;

    if (id) {
      await query(
        `
          UPDATE public.contacts
             SET display_name = COALESCE($2, display_name),
                 name         = COALESCE($2, name),
                 phone        = COALESCE($3, phone),
                 phone_e164   = COALESCE($3, phone_e164),
                 email        = COALESCE($4, email),
                 birthdate    = COALESCE($5::date, birthdate),
                 notes        = COALESCE($6, notes),
                 updated_at   = now()
           WHERE id = $1
        `,
        [id, name, phone, email, birthdate, notes]
      );
    } else {
      const inserted = await query(
        `
          INSERT INTO public.contacts
            (id, org_id, display_name, name, phone, phone_e164, email, birthdate, notes, created_at, updated_at)
          VALUES
            (gen_random_uuid(), $1, $2, $2, $3, $3, $4, $5::date, $6, now(), now())
          RETURNING id
        `,
        [orgId, name, phone, email, birthdate, notes]
      );
      id = inserted.rows[0]?.id || null;
    }

    if (!id) {
      return res.status(500).json({ error: 'contact_upsert_failed' });
    }

    for (const tagName of Array.isArray(tags) ? tags : []) {
      if (!tagName) continue;
      await query(
        `
          WITH existing AS (
            SELECT id
              FROM public.tags
             WHERE org_id = $1
               AND lower(name) = lower($2)
             LIMIT 1
          )
          INSERT INTO public.contact_tags (contact_id, tag_id, org_id)
          SELECT $3, existing.id, $1
            FROM existing
         ON CONFLICT DO NOTHING
        `,
        [orgId, tagName, id]
      );
    }

    if (funnelStatus) {
      await query(
        `
          UPDATE public.clients
             SET status = $2,
                 updated_at = now()
           WHERE id = (
                  SELECT client_id
                    FROM public.contacts
                   WHERE id = $1
                 )
             AND $2 IS NOT NULL
        `,
        [id, funnelStatus]
      ).catch(() => {});
    }

    await Audit.auditLog(null, {
      user_email: req.user?.email || null,
      action: 'ai.client.upsert',
      entity: 'contact',
      entity_id: id,
      payload: { phone, email },
    });

    res.json({ ok: true, contactId: id });
  } catch (err) {
    next(err);
  }
});

router.post('/ai/actions/client.delete', async (req, res, next) => {
  try {
    const { contactId } = req.body || {};
    if (!contactId) {
      return res.status(400).json({ error: 'contactId_required' });
    }

    await query(`DELETE FROM public.contacts WHERE id = $1`, [contactId]);

    await Audit.auditLog(null, {
      user_email: req.user?.email || null,
      action: 'ai.client.delete',
      entity: 'contact',
      entity_id: contactId,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
