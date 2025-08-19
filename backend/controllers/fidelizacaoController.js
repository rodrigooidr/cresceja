import { query } from '../config/db.js';

export async function sendNps(req, res, next) {
  try {
    const { clientId } = req.body || {};
    if (!clientId) return res.status(400).json({ error: 'missing_client_id' });
    const { rows } = await query(
      `INSERT INTO nps_surveys (client_id) VALUES ($1) RETURNING id, client_id, sent_at`,
      [clientId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function respondNps(req, res, next) {
  try {
    const surveyId = parseInt(req.params.surveyId, 10);
    const { score, comment } = req.body || {};
    if (!surveyId || typeof score !== 'number') {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const { rows } = await query(
      `INSERT INTO nps_responses (survey_id, score, comment)
       VALUES ($1,$2,$3)
       RETURNING id, survey_id, score, comment, responded_at`,
      [surveyId, score, comment || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function getNpsResults(req, res, next) {
  try {
    const clientId = parseInt(req.query.clientId, 10);
    if (!clientId) return res.status(400).json({ error: 'invalid_client' });
    const { rows } = await query(
      `SELECT r.score, r.comment, r.responded_at
         FROM nps_responses r
         JOIN nps_surveys s ON r.survey_id = s.id
        WHERE s.client_id = $1
        ORDER BY r.responded_at DESC`,
      [clientId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function createReward(req, res, next) {
  try {
    const { clientId, type, value, expiresAt } = req.body || {};
    if (!clientId || !type) return res.status(400).json({ error: 'invalid_input' });
    const { rows } = await query(
      `INSERT INTO rewards (client_id, type, value, expires_at)
       VALUES ($1,$2,$3,$4)
       RETURNING id, client_id, type, value, expires_at, created_at`,
      [clientId, type, value || null, expiresAt || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function getRewards(req, res, next) {
  try {
    const clientId = parseInt(req.query.clientId, 10);
    if (!clientId) return res.status(400).json({ error: 'invalid_client' });
    const { rows } = await query(
      `SELECT id, type, value, expires_at, created_at
         FROM rewards
        WHERE client_id = $1
        ORDER BY created_at DESC`,
      [clientId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function churnRisk(req, res, next) {
  try {
    const clientId = parseInt(req.query.clientId, 10);
    if (!clientId) return res.status(400).json({ error: 'invalid_client' });
    const { rows } = await query(
      `SELECT r.score, r.responded_at
         FROM nps_responses r
         JOIN nps_surveys s ON r.survey_id = s.id
        WHERE s.client_id = $1
        ORDER BY r.responded_at DESC
        LIMIT 1`,
      [clientId]
    );
    let risk = 'baixo';
    if (rows.length === 0 || rows[0].score <= 6) risk = 'alto';
    res.json({ risk });
  } catch (err) {
    next(err);
  }
}
