import { Router } from 'express';
import db from '#db';
import { requireOrgHeader } from '../middleware/requireOrgHeader.js';

const router = Router();

router.get('/clients', requireOrgHeader, async (req, res, next) => {
  try {
    const orgId = req.headers['x-org-id'];
    const q = (req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const where = [`org_id = $/orgId/`];
    const params = { orgId, limit, offset };

    if (q.length >= 2) {
      where.push(`(
        name ILIKE '%' || $/q/ || '%'
        OR email ILIKE '%' || $/q/ || '%'
        OR phone_e164 ILIKE '%' || $/q/ || '%'
      )`);
      params.q = q;
    }

    const rows = await db.any(`
      SELECT id, name, email, phone_e164, cpf, cnpj, created_at
      FROM clients
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $/limit/ OFFSET $/offset/
    `, params);

    const total = await db.one(`
      SELECT COUNT(*)::int AS c FROM clients WHERE ${where.join(' AND ')}
    `, params);

    res.json({ items: rows, total: total.c, page, pageSize: limit });
  } catch (e) { next(e); }
});

router.post('/clients', requireOrgHeader, async (req, res, next) => {
  try {
    const orgId = req.headers['x-org-id'];
    const { name, email, phone_e164, cpf, cnpj } = req.body;

    if (!name) return res.status(422).json({ error: 'validation', issues: [{ path: ['name'], message: 'Nome obrigatório' }] });
    if (!email && !phone_e164) return res.status(422).json({ error: 'validation', issues: [{ path: [], message: 'Informe e-mail ou telefone' }] });

    const dup = await db.oneOrNone(`
      SELECT 1 FROM clients
      WHERE org_id = $1
        AND (
          ($2::text IS NOT NULL AND lower(email)=lower($2))
       OR ($3::text IS NOT NULL AND phone_e164=$3)
       OR ($4::text IS NOT NULL AND regexp_replace(cpf, '\\D','','g') = regexp_replace($4, '\\D','','g'))
       OR ($5::text IS NOT NULL AND regexp_replace(cnpj,'\\D','','g') = regexp_replace($5,'\\D','','g'))
        )
      LIMIT 1
    `, [orgId, email || null, phone_e164 || null, cpf || null, cnpj || null]);
    if (dup) return res.status(409).json({ error: 'duplicate_client_key' });

    const cli = await db.one(`
      INSERT INTO clients (id, org_id, name, email, phone_e164, cpf, cnpj, created_at)
      VALUES (gen_random_uuid(), $1, $2, lower($3), $4, $5, $6, now())
      RETURNING id
    `, [orgId, name, email || null, phone_e164 || null, cpf || null, cnpj || null]);

    res.status(201).json({ id: cli.id });
  } catch (e) {
    next(e);
  }
});

export default router;

