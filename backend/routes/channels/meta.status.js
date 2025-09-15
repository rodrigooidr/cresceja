import express from 'express';
import { getLastImportRun } from '../../services/meta/import_runs.repo.js';

const router = express.Router();

// GET /channels/meta/accounts/:id/backfill/status
router.get('/channels/meta/accounts/:id/backfill/status', async (req, res) => {
  const orgId = req.header('X-Org-Id');
  if (!orgId) return res.status(401).json({ error: 'unauthorized' });

  const { id } = req.params;
  const last = await getLastImportRun(orgId, id);
  return res.json({ last: last || null });
});

export default router;
