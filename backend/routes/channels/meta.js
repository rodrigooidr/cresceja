import { getInboxRepo } from '../../services/inbox/repo.js';
import { subscribeFacebook, subscribeInstagram } from '../../services/meta/subscribe.js';
import { decrypt } from '../../services/crypto.js';

export default (app) => {
  const repo = getInboxRepo();

  app.get('/channels/meta/accounts', async (req, res) => {
    const orgId = req.auth?.orgId || req.headers['x-org-id'] || req.query.orgId || 'org_test';
    const { channel } = req.query;
    const items = await repo.listChannelAccounts({ org_id: orgId, channel });
    res.json({ items });
  });

  app.post('/channels/meta/accounts/connect', async (req, res) => {
    const orgId = req.auth?.orgId || req.headers['x-org-id'] || req.body?.orgId || 'org_test';
    const { channel, accounts } = req.body;
    if (!channel || !Array.isArray(accounts)) return res.status(400).json({ error: 'invalid_payload' });
    const out = [];
    for (const a of accounts) {
      const rec = await repo.seedChannelAccount({
        org_id: orgId,
        channel,
        external_account_id: String(a.external_account_id),
        name: a.name || null,
        username: a.username || null,
        access_token_enc: a.access_token_enc || null,
        permissions_json: a.permissions_json || [],
        webhook_subscribed: false,
      });
      out.push(rec);
    }
    res.json({ items: out });
  });

  app.post('/channels/meta/accounts/:id/subscribe', async (req, res) => {
    const acc = await repo.getChannelAccountById(req.params.id);
    if (!acc) return res.sendStatus(404);
    const token = acc.access_token || (acc.access_token_enc ? decrypt(acc.access_token_enc) : null);
    if (acc.channel === 'facebook') await subscribeFacebook(acc.external_account_id, token);
    if (acc.channel === 'instagram') await subscribeInstagram(acc.external_account_id, token);
    await repo.setChannelAccountSubscribed(acc.id, true);
    res.json({ ok: true });
  });

  app.delete('/channels/meta/accounts/:id', async (req, res) => {
    await repo.deleteChannelAccount(req.params.id);
    res.json({ ok: true });
  });
};
