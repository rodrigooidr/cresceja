import { Router } from 'express';
import { query, withTransaction } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// Converte oportunidade em cliente e inicia tarefas de onboarding
router.put('/opportunities/:id/converter', authRequired, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT o.cliente, l.email, l.telefone
           FROM opportunities o
           LEFT JOIN leads l ON o.lead_id = l.id
          WHERE o.id = $1
          FOR UPDATE`,
        [id]
      );
      if (rows.length === 0) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const opp = rows[0];
      const insert = await client.query(
        `INSERT INTO clients (nome, email, telefone)
         VALUES ($1,$2,$3)
         RETURNING id, nome, email, telefone, contrato_url, status, created_at`,
        [opp.cliente, opp.email || null, opp.telefone || null]
      );
      const novoCliente = insert.rows[0];
      await client.query(
        `INSERT INTO onboarding_tasks (client_id) VALUES ($1)`,
        [novoCliente.id]
      );
      await client.query(
        `UPDATE opportunities SET status = 'fechamento:ganho', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      res.json(novoCliente);
    });
  } catch (err) {
    next(err);
  }
});

// Lista clientes com status de onboarding
router.get('/onboarding', authRequired, async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.nome, c.email, c.telefone, c.contrato_url,
              t.contrato, t.assinatura, t.nota_fiscal, t.treinamento
         FROM clients c
         LEFT JOIN onboarding_tasks t ON t.client_id = c.id
        ORDER BY c.id DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Atualiza checklist de um cliente
router.put('/onboarding/:clientId', authRequired, async (req, res, next) => {
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
    const { rows } = await query(
      `UPDATE onboarding_tasks
          SET ${sets.join(', ')}, updated_at = NOW()
        WHERE client_id = $${valores.length + 1}
        RETURNING contrato, assinatura, nota_fiscal, treinamento`,
      [...valores, clientId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
