import { makeDbRepo } from '../../services/inbox/repo.db.js';
import { subscribeFacebook, subscribeInstagram } from '../../services/meta/subscribe.js';
import { decrypt } from '../../services/crypto.js';

export default (app) => {
  const repo = makeDbRepo();

  app.get('/channels/meta/accounts', async (req, res) => {
    const orgId = req.auth?.orgId || req.headers['x-org-id'];
    const { channel } = req.query;
    const { rows } = await repo._db.query(
      `SELECT * FROM channel_accounts WHERE org_id = $1 AND ($2::text IS NULL OR channel = $2) ORDER BY created_at DESC`,
      [orgId, channel || null]
    );
    res.json({ items: rows });
  });

  app.post('/channels/meta/accounts/connect', async (req, res) => {
    const orgId = req.auth?.orgId || req.headers['x-org-id'];
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
    const { rows } = await repo._db.query(`SELECT * FROM channel_accounts WHERE id = $1`, [req.params.id]);
    const acc = rows[0];
    if (!acc) return res.sendStatus(404);
    const token = decrypt(acc.access_token_enc);
    if (acc.channel === 'facebook') await subscribeFacebook(acc.external_account_id, token);
    if (acc.channel === 'instagram') await subscribeInstagram(acc.external_account_id, token);
    await repo._db.query(`UPDATE channel_accounts SET webhook_subscribed = TRUE WHERE id = $1`, [acc.id]);
    res.json({ ok: true });
  });

  app.delete('/channels/meta/accounts/:id', async (req, res) => {
    await repo._db.query(`DELETE FROM channel_accounts WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  });
};
