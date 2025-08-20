import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.use(authRequired, withOrg, requireRole('Agent'));

// GET /api/conversations?status=pendente&assigned_to=me
router.get('/', async (req, res) => {
  const { status, assigned_to } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
  const offset = (page - 1) * limit;

  let where = 'WHERE org_id = $1';
  const params = [req.orgId];
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  } else if (assigned_to === 'me') {
    params.push(req.user.email);
    where += ` AND assigned_to = $${params.length}`;
  }

  const countRes = await req.db.query(`SELECT COUNT(*) FROM conversations ${where}`, params);
  const total = Number(countRes.rows[0]?.count || 0);

  const listParams = [...params, limit, offset];
  const { rows } = await req.db.query(
    `SELECT * FROM conversations ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams
  );
  res.json({ data: rows, meta: { page, limit, total } });
});

// PUT /api/conversations/:id/assumir
router.put('/:id/assumir', async (req, res) => {
  const { id } = req.params;
  await req.db.query(
    `UPDATE conversations SET assigned_to = $1, status = $2, updated_at = NOW()
     WHERE id = $3 AND org_id = $4`,
    [req.user.email, 'em_andamento', id, req.orgId]
  );
  res.json({ data: { success: true } });
});

// PUT /api/conversations/:id/encerrar
router.put('/:id/encerrar', async (req, res) => {
  const { id } = req.params;
  await req.db.query(
    `UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`,
    ['resolvido', id, req.orgId]
  );
  res.json({ data: { success: true } });
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req, res) => {
  const { id } = req.params;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
  const offset = (page - 1) * limit;

  const countRes = await req.db.query(
    `SELECT COUNT(*) FROM messages WHERE conversation_id = $1 AND org_id = $2`,
    [id, req.orgId]
  );
  const total = Number(countRes.rows[0]?.count || 0);

  const { rows } = await req.db.query(
    `SELECT * FROM messages
       WHERE conversation_id = $1 AND org_id = $2
       ORDER BY created_at ASC
       LIMIT $3 OFFSET $4`,
    [id, req.orgId, limit, offset]
  );
  res.json({ data: rows, meta: { page, limit, total } });
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { content, sender = 'agente' } = req.body;
  if (!content) return res.status(400).json({ error: 'conteudo_obrigatorio' });

  const { rows } = await req.db.query(
    `INSERT INTO messages (org_id, conversation_id, sender, content)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.orgId, id, sender, content]
  );
  const msg = rows[0];
  const io = req.app.get('io');
  if (io) io.to(`conversation:${id}`).emit('message:new', msg);
  res.status(201).json({ data: msg });
});

export default router;
