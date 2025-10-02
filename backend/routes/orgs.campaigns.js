import { Router } from 'express';
import { requireRole, ROLES } from '../middleware/requireRole.js';
import { ensureEditable, cancelJobs } from '../services/campaigns.js';

const router = Router();

router.use(requireRole(ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.Support, ROLES.SuperAdmin));

// List campaigns of a month
router.get('/api/orgs/:orgId/campaigns', async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const month = req.query.month;
    const { rows } = await req.db.query(
      `SELECT id, title, month_ref, default_targets, strategy_json, created_at
         FROM content_campaigns
        WHERE org_id=$1 AND ($2::date IS NULL OR month_ref=$2::date)
        ORDER BY created_at DESC`,
      [orgId, month || null]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// Get campaign by id
router.get('/api/orgs/:orgId/campaigns/:campaignId', async (req, res, next) => {
  try {
    const { orgId, campaignId } = req.params;
    const { rows } = await req.db.query(
      `SELECT id, title, month_ref, default_targets, strategy_json, created_at
         FROM content_campaigns WHERE org_id=$1 AND id=$2`,
      [orgId, campaignId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// List suggestions paginated
router.get('/api/orgs/:orgId/campaigns/:campaignId/suggestions', async (req, res, next) => {
  try {
    const { orgId, campaignId } = req.params;
    const page = Math.max(parseInt(req.query.page,10)||1,1);
    const pageSize = Math.max(parseInt(req.query.pageSize,10)||50,1);
    const offset = (page-1)*pageSize;
    const { rows } = await req.db.query(
      `SELECT id, date, time, status, channel_targets, copy_json, asset_refs
         FROM content_suggestions
        WHERE org_id=$1 AND campaign_id=$2
        ORDER BY date ASC
        LIMIT $3 OFFSET $4`,
      [orgId, campaignId, pageSize, offset]
    );
    res.json({ data: rows, page, pageSize });
  } catch (err) { next(err); }
});

// Apply targets to multiple suggestions in a campaign
router.patch('/api/orgs/:orgId/campaigns/:campaignId/suggestions/apply-targets', async (req, res, next) => {
  try {
    const { orgId, campaignId } = req.params;
    const { ig, fb, onlyStatus = ['suggested'] } = req.body || {};
    if (!ig && !fb) return res.status(400).json({ error: 'validation', field: 'targets' });

    const params = [orgId, campaignId];
    const sets = [];
    let idx = 3;
    if (ig) {
      sets.push(`channel_targets = jsonb_set(COALESCE(channel_targets,'{}'::jsonb),'{instagram}',$${idx}::jsonb,true)`);
      params.push(JSON.stringify({ enabled: !!ig.enabled, accountId: ig.accountId || null }));
      idx++;
    }
    if (fb) {
      sets.push(`channel_targets = jsonb_set(COALESCE(channel_targets,'{}'::jsonb),'{facebook}',$${idx}::jsonb,true)`);
      params.push(JSON.stringify({ enabled: !!fb.enabled, pageId: fb.pageId || null }));
      idx++;
    }
    params.push(onlyStatus);
    const sql = `UPDATE content_suggestions SET ${sets.join(', ')}, updated_at=now()
                 WHERE org_id=$1 AND campaign_id=$2 AND status = ANY($${idx}::text[])`;
    const result = await req.db.query(sql, params);
    res.json({ updated: result.rowCount || 0, skipped: [], errors: [] });
  } catch (err) { next(err); }
});

// Update suggestion
router.patch('/api/orgs/:orgId/suggestions/:suggestionId', async (req, res, next) => {
  try {
    const { orgId, suggestionId } = req.params;
    const { date, time, channel_targets, copy_json, asset_refs } = req.body || {};
    const check = await ensureEditable(req.db, orgId, suggestionId);
    if (check.error) return res.status(409).json({ error: check.error });
    if (check.pendingJobs) {
      await cancelJobs(req.db, orgId, check.pendingJobs);
      await req.db.query(
        `UPDATE content_suggestions SET status='suggested', jobs_map='{}'::jsonb, updated_at=now() WHERE org_id=$1 AND id=$2`,
        [orgId, suggestionId]
      );
    }
    const { rows } = await req.db.query(
      `UPDATE content_suggestions
          SET date = COALESCE($3,date),
              time = COALESCE($4,time),
              channel_targets = COALESCE($5, channel_targets),
              copy_json = COALESCE($6, copy_json),
              asset_refs = COALESCE($7, asset_refs),
              updated_at = now()
        WHERE id=$2 AND org_id=$1
        RETURNING id, date, time, channel_targets, copy_json, asset_refs, status`,
      [orgId, suggestionId, date, time, channel_targets ? JSON.stringify(channel_targets):null, copy_json ? JSON.stringify(copy_json):null, asset_refs ? JSON.stringify(asset_refs):null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Regenerate copy
router.post('/api/orgs/:orgId/suggestions/:suggestionId/regen', async (req, res, next) => {
  try {
    const { orgId, suggestionId } = req.params;
    const { feedback } = req.body || {};
    const copy = await import('../services/ai/text.js').then(m => m.generateSuggestion({ prompt: feedback || '' }));
    const { rows } = await req.db.query(
      `UPDATE content_suggestions SET copy_json=$3, updated_at=now() WHERE id=$2 AND org_id=$1 RETURNING id, copy_json`,
      [orgId, suggestionId, JSON.stringify(copy)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Get jobs status for a suggestion
router.get('/api/orgs/:orgId/suggestions/:suggestionId/jobs', async (req, res, next) => {
  try {
    const { orgId, suggestionId } = req.params;
    const { rows: [sug] } = await req.db.query(
      'SELECT jobs_map FROM content_suggestions WHERE org_id=$1 AND id=$2',
      [orgId, suggestionId]
    );
    if (!sug) return res.status(404).json({ error: 'not_found' });
    const igId = sug.jobs_map?.instagram || null;
    const fbId = sug.jobs_map?.facebook || null;
    let igStatus = null;
    let fbStatus = null;
    if (igId) {
      const { rows:[job] } = await req.db.query('SELECT status FROM instagram_publish_jobs WHERE org_id=$1 AND id=$2', [orgId, igId]);
      igStatus = job?.status || null;
    }
    if (fbId) {
      const { rows:[job] } = await req.db.query('SELECT status FROM facebook_publish_jobs WHERE org_id=$1 AND id=$2', [orgId, fbId]);
      fbStatus = job?.status || null;
    }
    res.json({ ig: { jobId: igId || null, status: igStatus }, fb: { jobId: fbId || null, status: fbStatus } });
  } catch (err) { next(err); }
});

// Delete suggestion
router.delete('/api/orgs/:orgId/suggestions/:suggestionId', async (req, res, next) => {
  try {
    const { orgId, suggestionId } = req.params;
    const { rows } = await req.db.query(
      `DELETE FROM content_suggestions WHERE org_id=$1 AND id=$2 AND status <> 'published' RETURNING id`,
      [orgId, suggestionId]
    );
    if (!rows[0]) return res.status(409).json({ error: 'cannot_delete_published' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
