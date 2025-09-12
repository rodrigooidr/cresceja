// backend/routes/orgs.js
import { Router } from 'express';
import { pool } from '#db';

const router = Router();

/**
 * GET /api/orgs?visibility=mine|all&q=&page=1&pageSize=50
 * - SuperAdmin/Support + visibility=all => lista TODAS de `orgs`
 * - Demais => lista orgs onde há vínculo em `org_users`
 * - Fallback: se vier vazio e o token tiver org_id, devolve 1 item sintético
 */
router.get('/', async (req, res) => {
  const client = req.db || (await pool.connect());
  const mustRelease = !req.db;

  try {
    const user = req.user || {};
    const { visibility = 'mine', q = '', page = 1, pageSize = 50 } = req.query;

    const isSuper = ['SuperAdmin', 'Support'].includes(user.role);
    const wantAll = isSuper && String(visibility).toLowerCase() === 'all';

    const limit  = Math.max(1, Math.min(Number(pageSize) || 50, 200));
    const offset = Math.max(0, ((Number(page) || 1) - 1) * limit);

    const params = [];
    let i = 1;
    const where = [];

    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      where.push(`(o.name ILIKE $${i++})`);
    }

    let sqlList, sqlCount;

    if (wantAll) {
      // Lista direto da tabela orgs
      sqlList = `
        SELECT o.id, o.name, NULL::text AS slug, o.status, o.created_at
        FROM orgs o
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY o.name ASC
        LIMIT $${i} OFFSET $${i + 1}`;
      sqlCount = `
        SELECT COUNT(*)::int AS total
        FROM orgs o
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
      params.push(limit, offset);
    } else {
      // "Minhas" orgs via org_users
      params.push(user.id);
      const whereMine = [`m.user_id = $${i++}`, ...where];

      sqlList = `
        SELECT o.id, o.name, NULL::text AS slug, o.status, o.created_at
        FROM org_users m
        JOIN orgs o ON o.id = m.org_id
        ${whereMine.length ? `WHERE ${whereMine.join(' AND ')}` : ''}
        ORDER BY o.name ASC
        LIMIT $${i} OFFSET $${i + 1}`;
      sqlCount = `
        SELECT COUNT(*)::int AS total
        FROM org_users m
        JOIN orgs o ON o.id = m.org_id
        ${whereMine.length ? `WHERE ${whereMine.join(' AND ')}` : ''}`;
      params.push(limit, offset);
    }

    const [rowsRes, countRes] = await Promise.all([
      client.query(sqlList, params),
      client.query(sqlCount, params.slice(0, params.length - 2)),
    ]);

    let items = rowsRes.rows || [];

    // Fallback para não travar a UI
    if (items.length === 0 && user.org_id) {
      items = [{
        id: user.org_id,
        name: 'Default Org',
        slug: null,
        status: 'active',
        created_at: null,
        synthetic: true,
      }];
    }

    return res.json({
      items,
      total: items.length,
      page: Number(page) || 1,
      pageSize: limit,
    });
  } catch (e) {
    req.log?.error({ err: e }, 'GET /orgs failed');
    return res.status(500).json({ error: 'orgs_list_failed', message: e.message });
  } finally {
    if (mustRelease) client.release();
  }
});

export default router;
