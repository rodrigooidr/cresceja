import { enqueue } from '../services/email/index.js';

export async function listLists(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;
    const totalRes = await req.db.query('SELECT COUNT(*) FROM email_lists WHERE org_id=$1', [req.orgId]);
    const total = Number(totalRes.rows[0]?.count || 0);
    const { rows } = await req.db.query(
      `SELECT id, name, created_at, updated_at
         FROM email_lists
        WHERE org_id=$1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [req.orgId, limit, offset]
    );
    res.json({ data: rows, meta: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

export async function createList(req, res, next) {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'invalid_input' });
    const { rows } = await req.db.query(
      `INSERT INTO email_lists (org_id, name)
       VALUES ($1,$2)
       RETURNING id, name, created_at, updated_at`,
      [req.orgId, name]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function updateList(req, res, next) {
  try {
    const { id } = req.params;
    const { name } = req.body || {};
    const { rows } = await req.db.query(
      `UPDATE email_lists SET name=$1, updated_at=NOW()
        WHERE id=$2 AND org_id=$3
        RETURNING id, name, created_at, updated_at`,
      [name, id, req.orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function deleteList(req, res, next) {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM email_lists WHERE id=$1 AND org_id=$2', [id, req.orgId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function listTemplates(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;
    const totalRes = await req.db.query('SELECT COUNT(*) FROM email_templates WHERE org_id=$1', [req.orgId]);
    const total = Number(totalRes.rows[0]?.count || 0);
    const { rows } = await req.db.query(
      `SELECT id, name, subject, body, created_at, updated_at
         FROM email_templates
        WHERE org_id=$1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [req.orgId, limit, offset]
    );
    res.json({ data: rows, meta: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req, res, next) {
  try {
    const { name, subject, body } = req.body || {};
    if (!name || !subject || !body) return res.status(400).json({ error: 'invalid_input' });
    const { rows } = await req.db.query(
      `INSERT INTO email_templates (org_id, name, subject, body)
       VALUES ($1,$2,$3,$4)
       RETURNING id, name, subject, body, created_at, updated_at`,
      [req.orgId, name, subject, body]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req, res, next) {
  try {
    const { id } = req.params;
    const { name, subject, body } = req.body || {};
    const { rows } = await req.db.query(
      `UPDATE email_templates
          SET name=$1, subject=$2, body=$3, updated_at=NOW()
        WHERE id=$4 AND org_id=$5
        RETURNING id, name, subject, body, created_at, updated_at`,
      [name, subject, body, id, req.orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req, res, next) {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM email_templates WHERE id=$1 AND org_id=$2', [id, req.orgId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function listCampaigns(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;
    const totalRes = await req.db.query('SELECT COUNT(*) FROM email_campaigns WHERE org_id=$1', [req.orgId]);
    const total = Number(totalRes.rows[0]?.count || 0);
    const { rows } = await req.db.query(
      `SELECT id, name, template_id, list_id, status, scheduled_at, created_at, updated_at
         FROM email_campaigns
        WHERE org_id=$1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [req.orgId, limit, offset]
    );
    res.json({ data: rows, meta: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

export async function createCampaign(req, res, next) {
  try {
    const { name, template_id, list_id } = req.body || {};
    if (!name || !template_id || !list_id) return res.status(400).json({ error: 'invalid_input' });
    const { rows } = await req.db.query(
      `INSERT INTO email_campaigns (org_id, name, template_id, list_id)
       VALUES ($1,$2,$3,$4)
       RETURNING id, name, template_id, list_id, status, scheduled_at, created_at, updated_at`,
      [req.orgId, name, template_id, list_id]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function deleteCampaign(req, res, next) {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM email_campaigns WHERE id=$1 AND org_id=$2', [id, req.orgId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function sendTest(req, res, next) {
  try {
    const { id } = req.params;
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ error: 'invalid_input' });
    const { rows } = await req.db.query(
      `SELECT c.id, t.subject, t.body
         FROM email_campaigns c
         JOIN email_templates t ON t.id = c.template_id
        WHERE c.id=$1 AND c.org_id=$2`,
      [id, req.orgId]
    );
    const campaign = rows[0];
    if (!campaign) return res.status(404).json({ error: 'not_found' });
    await enqueue({
      to,
      subject: campaign.subject,
      html: campaign.body,
      orgId: req.orgId,
      campaignId: id,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function scheduleCampaign(req, res, next) {
  try {
    const { id } = req.params;
    const { sendAt } = req.body || {};
    const { rows } = await req.db.query(
      `UPDATE email_campaigns SET scheduled_at=$1, status='scheduled', updated_at=NOW()
        WHERE id=$2 AND org_id=$3
        RETURNING id, template_id, list_id, name, scheduled_at`,
      [sendAt, id, req.orgId]
    );
    const campaign = rows[0];
    if (!campaign) return res.status(404).json({ error: 'not_found' });
    const tplRes = await req.db.query(
      `SELECT subject, body FROM email_templates WHERE id=$1 AND org_id=$2`,
      [campaign.template_id, req.orgId]
    );
    const template = tplRes.rows[0];
    const subsRes = await req.db.query(
      `SELECT id, email FROM email_subscriptions WHERE list_id=$1 AND status='subscribed' AND org_id=$2`,
      [campaign.list_id, req.orgId]
    );
    for (const sub of subsRes.rows) {
      const recRes = await req.db.query(
        `INSERT INTO email_campaign_recipients (org_id, campaign_id, subscription_id, email)
         VALUES ($1,$2,$3,$4)
         RETURNING id`,
        [req.orgId, id, sub.id, sub.email]
      );
      const recipientId = recRes.rows[0].id;
      await enqueue({
        to: sub.email,
        subject: template.subject,
        html: template.body,
        orgId: req.orgId,
        campaignId: id,
        recipientId,
      });
    }
    res.json({ data: campaign });
  } catch (err) {
    next(err);
  }
}

export async function handleWebhook(req, res, next) {
  try {
    const { provider } = req.params;
    console.log('webhook', provider, req.body);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
