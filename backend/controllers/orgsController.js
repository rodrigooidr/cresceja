import { query } from '../config/db.js';
import { randomUUID } from 'crypto';

export async function getMe(req, res, next) {
  try {
    const { rows } = await req.db.query(
      'SELECT id, name, plan_id FROM orgs WHERE id = $1',
      [req.orgId]
    );
    const org = rows[0] || null;
    res.json({ data: org, role: req.orgRole });
  } catch (err) {
    next(err);
  }
}

export async function adminList(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT id, name, plan_id, created_at FROM orgs ORDER BY created_at DESC'
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

export async function adminCreate(req, res, next) {
  try {
    const { name, plan_id } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name_required' });
    const id = randomUUID();
    await query(
      'INSERT INTO orgs (id, name, plan_id) VALUES ($1, $2, $3)',
      [id, name, plan_id]
    );
    res.status(201).json({ id, name, plan_id });
  } catch (err) {
    next(err);
  }
}
