import { Router } from 'express';

const router = Router();

// GET /api/orgs/:orgId/features
router.get('/api/orgs/:orgId/features', async (req, res) => {
  const { orgId } = req.params;

  // TODO: se houver persistência de flags, substituir por consulta real
  const features = {
    inbox: { enabled: true, limit: null },
    inbox_conversations_v2: { enabled: true, limit: null },
    google_calendar_integration: { enabled: false, limit: null },
  };

  return res.status(200).json({ org_id: orgId, features });
});

export default router;
