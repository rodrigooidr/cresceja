import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { requireRole, ROLES } from '../middleware/requireRole.js';

const router = Router();

const AGENT_ROLES = [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];

router.use(authRequired, withOrg, requireRole(AGENT_ROLES));

// Converte oportunidade em cliente e inicia tarefas de onboarding
router.put('/opportunities/:id/converter', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    const { rows } = await req.db.query(
      `SELECT o.cliente, l.email, l.telefone
         FROM opportunities o
         LEFT JOIN leads l ON o.lead_id = l.id AND l.org_id = $2
        WHERE o.id = $1 AND o.org_id = $2
        FOR UPDATE`,
      [id, req.orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
    const opp = rows[0];
    const insert = await req.db.query(
      `INSERT INTO clients (org_id, nome, email, telefone)
       VALUES ($1,$2,$3,$4)
       RETURNING id, nome, email, telefone, contrato_url, status, created_at`,
      [req.orgId, opp.cliente, opp.email || null, opp.telefone || null]
    );
    const novoCliente = insert.rows[0];
    await req.db.query(
      `INSERT INTO onboarding_tasks (org_id, client_id) VALUES ($1,$2)`,
      [req.orgId, novoCliente.id]
    );
    await req.db.query(
      `UPDATE opportunities SET status = 'fechamento:ganho', updated_at = NOW()
       WHERE id = $1 AND org_id = $2`,
      [id, req.orgId]
    );
    res.json({ data: novoCliente });
  } catch (err) {
    next(err);
  }
});

// Lista clientes com status de onboarding
router.get('/onboarding', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const countRes = await req.db.query(
      `SELECT COUNT(*) FROM clients WHERE org_id = $1`,
      [req.orgId]
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const { rows } = await req.db.query(
      `SELECT c.id, c.nome, c.email, c.telefone, c.contrato_url,
              t.contrato, t.assinatura, t.nota_fiscal, t.treinamento
         FROM clients c
         LEFT JOIN onboarding_tasks t ON t.client_id = c.id AND t.org_id = $1
        WHERE c.org_id = $1
        ORDER BY c.id DESC
        LIMIT $2 OFFSET $3`,
      [req.orgId, limit, offset]
    );
    res.json({ data: rows, meta: { page, limit, total } });
  } catch (err) {
    next(err);
  }
});

// Atualiza checklist de um cliente
router.put('/onboarding/:clientId', async (req, res, next) => {
  const clientId = parseInt(req.params.clientId, 10);
  if (!clientId) return res.status(400).json({ error: 'invalid_id' });
  const campos = ['contrato', 'assinatura', 'nota_fiscal', 'treinamento'];
  const sets = [];
  const valores = [];
  for (const campo of campos) {
    if (typeof req.body[campo] === 'boolean') {
      valores.push(req.body[campo]);
      sets.push(`${campo} = $${valores.length}`);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'no_fields' });
  try {
    valores.push(req.orgId);
    valores.push(clientId);
    const { rows } = await req.db.query(
      `UPDATE onboarding_tasks
          SET ${sets.join(', ')}, updated_at = NOW()
        WHERE org_id = $${valores.length - 1} AND client_id = $${valores.length}
        RETURNING contrato, assinatura, nota_fiscal, treinamento`,
      valores
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
