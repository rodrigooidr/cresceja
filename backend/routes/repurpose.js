// ESM
import express from 'express';
import { enqueueRepurpose, repurposeQueue } from '../services/repurposeQueue.js';

const router = express.Router();

// Enfileirar (repurpose)
router.post('/:postId', async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { modes } = req.body || {};
    const job = await enqueueRepurpose({ postId, modes });
    res.json({ queued: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
});

// Status por postId (busca por dados do job)
router.get('/:postId/status', async (req, res, next) => {
  try {
    const { postId } = req.params;
    const jobs = await repurposeQueue.getJobs(
      ['completed', 'failed', 'waiting', 'active', 'delayed'],
      0,
      200
    );
    const found = jobs.find(j => j?.data?.postId === postId);
    if (!found) return res.json({ status: 'none' });
    if (found.failedReason) return res.json({ status: 'failed', reason: found.failedReason });
    if (found.finishedOn) return res.json({ status: 'completed' });
    return res.json({ status: found.state || 'queued' });
  } catch (err) {
    next(err);
  }
});

export default router;