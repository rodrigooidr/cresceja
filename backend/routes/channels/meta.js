import { getInboxRepo } from '../../services/inbox/repo.js';
import { subscribeFacebook, subscribeInstagram } from '../../services/meta/subscribe.js';
import { encrypt, decrypt } from '../../services/crypto.js';
import {
  exchangeUserToken,
  listPagesWithTokens,
  getIgBusiness,
  hasPerm,
} from '../../services/meta/oauth.js';
import { backfillFacebook, backfillInstagram } from '../../services/meta/backfill.js';
import { ingestIncoming } from '../../services/inbox/ingest.js';

function parseEncPayload(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && raw.c) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
}

function resolveAccountToken(acc = {}) {
  if (acc.access_token) return acc.access_token;
  const enc = parseEncPayload(acc.access_token_enc);
  if (!enc) return null;
  try {
    return decrypt(enc);
  } catch {
    return null;
  }
}

export default (app) => {
  const repo = getInboxRepo();

  app.get('/channels/meta/accounts', async (req, res) => {
    const orgId = req.auth?.orgId || req.headers['x-org-id'] || req.query.orgId || 'org_test';
    const { channel } = req.query;
    const items = await repo.listChannelAccounts({ org_id: orgId, channel });
    res.json({ items });
  });

  app.post('/channels/meta/accounts/connect', async (req, res) => {
    const orgId =
      req.auth?.orgId ||
      req.headers['x-org-id'] ||
      req.query?.orgId ||
      req.body?.orgId ||
      'org_test';
    const { userAccessToken, accounts, channel: fallbackChannel } = req.body || {};

    const created = [];

    try {
      if (userAccessToken) {
        const longLivedToken = await exchangeUserToken(userAccessToken);
        const pages = await listPagesWithTokens(longLivedToken);
        for (const page of pages) {
          if (!page?.id || !page?.access_token) continue;
          const perms = Array.isArray(page.perms) ? page.perms : [];
          const enc = encrypt(page.access_token);
          const fbRec = await repo.seedChannelAccount({
            org_id: orgId,
            channel: 'facebook',
            external_account_id: String(page.id),
            name: page.name || null,
            username: null,
            access_token_enc: enc,
            permissions_json: perms,
            webhook_subscribed: false,
          });
          created.push({ ...fbRec, messaging_perms_ok: hasPerm(perms, 'PAGES_MESSAGING') || hasPerm(perms, 'pages_messaging') });

          try {
            const ig = await getIgBusiness(page.id, page.access_token);
            if (ig?.id) {
              const igRec = await repo.seedChannelAccount({
                org_id: orgId,
                channel: 'instagram',
                external_account_id: String(ig.id),
                name: ig.username || null,
                username: ig.username || null,
                access_token_enc: enc,
                permissions_json: perms,
                webhook_subscribed: false,
              });
              created.push({
                ...igRec,
                messaging_perms_ok:
                  hasPerm(perms, 'instagram_manage_messages') ||
                  hasPerm(perms, 'PAGES_MESSAGING') ||
                  hasPerm(perms, 'pages_messaging'),
              });
            }
          } catch (err) {
            // best-effort: ignora falhas ao buscar IG vinculado
          }
        }
      } else if (Array.isArray(accounts)) {
        for (const account of accounts) {
          if (!account?.external_account_id) continue;
          const perms = Array.isArray(account.permissions_json)
            ? account.permissions_json
            : Array.isArray(account.perms)
              ? account.perms
              : [];
          let enc = null;
          if (account.access_token) {
            enc = encrypt(account.access_token);
          } else if (account.access_token_enc) {
            enc = typeof account.access_token_enc === 'string'
              ? (() => { try { return JSON.parse(account.access_token_enc); } catch { return null; } })()
              : account.access_token_enc;
          }
          const rec = await repo.seedChannelAccount({
            org_id: orgId,
            channel: account.channel || fallbackChannel || 'facebook',
            external_account_id: String(account.external_account_id),
            name: account.name || null,
            username: account.username || null,
            access_token_enc: enc,
            permissions_json: perms,
            webhook_subscribed: false,
          });
          const manualPermsOk =
            hasPerm(perms, 'PAGES_MESSAGING') ||
            hasPerm(perms, 'pages_messaging') ||
            hasPerm(perms, 'instagram_manage_messages');
          created.push({ ...rec, messaging_perms_ok: manualPermsOk });
        }
      } else {
        return res.status(400).json({ error: 'invalid_payload' });
      }

      const finalItems = [];
      for (const acc of created) {
        let current = acc;
        const extra = 'messaging_perms_ok' in acc ? { messaging_perms_ok: acc.messaging_perms_ok } : {};
        const encPayload = acc.access_token_enc && typeof acc.access_token_enc === 'string'
          ? (() => { try { return JSON.parse(acc.access_token_enc); } catch { return null; } })()
          : acc.access_token_enc;
        try {
          const token = encPayload ? decrypt(encPayload) : acc.access_token || null;
          if (token) {
            if (acc.channel === 'facebook') await subscribeFacebook(acc.external_account_id, token);
            if (acc.channel === 'instagram') await subscribeInstagram(acc.external_account_id, token);
          }
          if (typeof repo.markAccountSubscribed === 'function') {
            const updated = await repo.markAccountSubscribed(acc.id);
            if (updated) current = { ...updated, ...extra };
          } else if (typeof repo.setChannelAccountSubscribed === 'function') {
            const updated = await repo.setChannelAccountSubscribed(acc.id, true);
            if (updated) current = { ...updated, ...extra };
          } else {
            current = { ...current, webhook_subscribed: true, ...extra };
          }
        } catch (err) {
          // ignora falha individual ao assinar
        }
        finalItems.push({ ...current, ...extra });
      }

      res.json({ items: finalItems });
    } catch (err) {
      res.status(502).json({ error: 'meta_connect_failed' });
    }
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

  app.post('/channels/meta/accounts/:id/backfill', async (req, res) => {
    const hours = Number(req.query.hours || 24);
    const interval = Number.isFinite(hours) && hours > 0 ? hours : 24;
    const acc = await repo.getChannelAccountById(req.params.id);
    if (!acc) return res.sendStatus(404);
    const token = resolveAccountToken(acc);
    if (!token) return res.status(400).json({ error: 'missing_token' });

    const since = Date.now() - interval * 60 * 60 * 1000;
    try {
      let events = [];
      if (acc.channel === 'facebook') {
        events = await backfillFacebook(acc.external_account_id, token, since);
      } else if (acc.channel === 'instagram') {
        events = await backfillInstagram(acc.external_account_id, token, since);
      } else {
        return res.status(400).json({ error: 'unsupported_channel' });
      }

      const seen = new Set();
      let messages = 0;
      for (const evt of events) {
        const result = await ingestIncoming(evt);
        if (result?.messageCreated) messages += 1;
        if (result?.conversationCreated && result?.conversationId) {
          seen.add(result.conversationId);
        }
      }

      res.json({ imported: { conversations: seen.size, messages } });
    } catch (err) {
      res.status(502).json({ error: 'meta_backfill_failed' });
    }
  });
};
