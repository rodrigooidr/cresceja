import { makeDbRepo } from '../services/inbox/repo.db.js';
import { sendMessengerText, sendInstagramText } from '../services/meta/send.js';
import { decrypt } from '../services/crypto.js';

export default (app) => {
  const repo = makeDbRepo();

  app.post('/inbox/messages', async (req, res) => {
    const orgId = req.auth?.orgId || req.headers['x-org-id'];
    const { conversationId, text } = req.body;
    if (!conversationId || !text) return res.status(400).json({ error: 'invalid_payload' });

    const { rows: convRows } = await repo._db.query(
      `SELECT * FROM conversations WHERE id = $1 AND org_id = $2`,
      [conversationId, orgId]
    );
    const conv = convRows[0];
    if (!conv) return res.sendStatus(404);

    const { rows: accRows } = await repo._db.query(
      `SELECT * FROM channel_accounts WHERE id = $1`,
      [conv.account_id]
    );
    const acc = accRows[0];
    if (!acc) return res.status(400).json({ error: 'account_not_found' });

    const { rows: lastInRows } = await repo._db.query(
      `SELECT sent_at FROM messages WHERE conversation_id = $1 AND direction = 'in' ORDER BY sent_at DESC LIMIT 1`,
      [conversationId]
    );
    const within24h = lastInRows[0]
      ? Date.now() - new Date(lastInRows[0].sent_at).getTime() <= 24 * 60 * 60 * 1000
      : true;
    if (!within24h) return res.status(400).json({ error: 'outside_24h' });

    const token = decrypt(acc.access_token_enc);

    if (conv.channel === 'facebook') {
      await sendMessengerText(acc.external_account_id, token, conv.external_user_id, text);
    } else if (conv.channel === 'instagram') {
      await sendInstagramText(acc.external_account_id, token, conv.external_user_id, text);
    } else {
      return res.status(400).json({ error: 'unsupported_channel' });
    }

    await repo._db.query(
      `INSERT INTO messages (org_id, conversation_id, external_message_id, direction, text, attachments_json, sent_at, raw_json)
       VALUES ($1,$2,$3,'out',$4,'[]'::jsonb,NOW(),$5)`,
      [orgId, conversationId, `local_${Date.now()}`, text, {}]
    );
    await repo._db.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [conversationId]);

    res.json({ ok: true });
  });
};
