import { getInboxRepo } from '../services/inbox/repo.js';
import { sendMessengerText, sendInstagramText } from '../services/meta/send.js';
import { decrypt } from '../services/crypto.js';

export default (app) => {
  const repo = getInboxRepo();

  app.post('/inbox/messages', async (req, res) => {
    const orgId = req.auth?.orgId || req.headers['x-org-id'] || req.query.orgId || 'org_test';
    const { conversationId, text } = req.body;
    if (!conversationId || !text) return res.status(400).json({ error: 'invalid_payload' });

    const conv = await repo.getConversationById(conversationId, orgId);
    if (!conv) return res.sendStatus(404);

    const acc = await repo.getChannelAccountById(conv.account_id);
    if (!acc) return res.status(400).json({ error: 'account_not_found' });

    const lastIn = await repo.getLastIncomingAt(conversationId);
    const within24h = lastIn
      ? Date.now() - new Date(lastIn).getTime() <= 24 * 60 * 60 * 1000
      : true;

    if (conv.channel === 'instagram' && !within24h) {
      return res.status(400).json({ error: 'outside_24h' });
    }
    if (conv.channel === 'facebook' && !within24h) {
      return res.status(400).json({ error: 'outside_24h' });
    }

    const token = acc.access_token || (acc.access_token_enc ? decrypt(acc.access_token_enc) : null);

    if (conv.channel === 'facebook') {
      await sendMessengerText(acc.external_account_id, token, conv.external_user_id, text);
    } else if (conv.channel === 'instagram') {
      await sendInstagramText(acc.external_account_id, token, conv.external_user_id, text);
    } else {
      return res.status(400).json({ error: 'unsupported_channel' });
    }

    await repo.appendOutgoingMessage({
      org_id: orgId,
      conversation_id: conversationId,
      text,
      raw_json: {},
    });

    res.json({ ok: true });
  });
};
