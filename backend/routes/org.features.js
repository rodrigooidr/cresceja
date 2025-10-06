import { Router } from 'express';

const router = Router();

// GET /api/orgs/:orgId/features
router.get('/api/orgs/:orgId/features', async (req, res) => {
  const { orgId } = req.params;

  // TODO: se houver persistência de flags, substituir por consulta real
  const features = {
    inbox: true,
    inbox_conversations_v2: true,
    ai_draft: true,
    ai_summarize: true,
    ai_classify: true,
    templates: true,
    google_calendar_integration: false,
    calendar_scheduling: true,
  };

  const feature_configs = {
    inbox: { enabled: true, limit: null },
    inbox_conversations_v2: { enabled: true, limit: null },
    ai_draft: { enabled: true, limit: null },
    ai_summarize: { enabled: true, limit: null },
    ai_classify: { enabled: true, limit: null },
    templates: { enabled: true, limit: null },
    google_calendar_integration: { enabled: false, limit: null },
    calendar_scheduling: { enabled: true, limit: null },
  };

  return res.status(200).json({ org_id: orgId, features, feature_configs });
});

export default router;
