import { getInboxRepo } from '../services/inbox/repo.js';
import { getSignedMediaUrl, getLocalMediaStream, isS3Enabled } from '../services/media/store.js';

function resolveOrgId(req) {
  return (
    req.auth?.orgId ||
    req.headers['x-org-id'] ||
    req.query.orgId ||
    null
  );
}

export default (app) => {
  app.get('/api/media/:messageId/:index', async (req, res) => {
    const orgId = resolveOrgId(req);
    const { messageId, index } = req.params;
    const repo = getInboxRepo();
    const message = await repo.getMessageById(messageId);
    if (!message) return res.sendStatus(404);
    if (message.org_id && orgId && String(message.org_id) !== String(orgId)) {
      return res.sendStatus(404);
    }

    const attachments = Array.isArray(message.attachments_json) ? message.attachments_json : [];
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= attachments.length) {
      return res.sendStatus(404);
    }
    const attachment = attachments[idx];
    if (!attachment) return res.sendStatus(404);

    if (attachment.storage_key) {
      if (isS3Enabled()) {
        const signed = await getSignedMediaUrl(attachment.storage_key);
        if (!signed) return res.sendStatus(404);
        return res.redirect(signed);
      }
      try {
        const payload = await getLocalMediaStream(attachment.storage_key);
        if (!payload) return res.sendStatus(404);
        if (attachment.mime) res.type(attachment.mime);
        if (payload.size) res.setHeader('Content-Length', payload.size);
        payload.stream.on('error', () => {
          if (!res.headersSent) res.sendStatus(404);
          else res.destroy();
        });
        payload.stream.pipe(res);
        return;
      } catch {
        return res.sendStatus(404);
      }
    }

    const remote = attachment.remote_url || attachment.url;
    if (remote) return res.redirect(remote);

    return res.sendStatus(404);
  });
};
