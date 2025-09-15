import { getInboxRepo } from '../services/inbox/repo.js';

export default (app) => {
  // Nota: adapte a extração de orgId ao seu middleware de auth
  function getOrgId(req) {
    return req.auth?.orgId || req.headers['x-org-id'] || req.query.orgId || 'org_test';
  }

  app.get('/inbox/conversations', async (req, res) => {
    const repo = getInboxRepo();
    const org_id = String(getOrgId(req));
    const { channel, accountId, limit, offset } = req.query;
    const out = await repo.listConversations({
      org_id,
      channel: channel || undefined,
      account_id: accountId || undefined,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });
    res.json(out);
  });

  app.get('/inbox/conversations/:id/messages', async (req, res) => {
    const repo = getInboxRepo();
    const { id } = req.params;
    const { limit, offset } = req.query;
    const out = await repo.listMessages({
      conversation_id: id,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });
    res.json(out);
  });
};
