import express from 'express';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { getPresignedOrPublic } from '../services/media/store.js';
import {
  getAttachmentByMessageIdx,
  userHasAccessToOrg,
  getMessageOrg,
} from '../services/inbox/repo.js';

const log = pino().child({ route: 'media' });
const router = express.Router();

router.get('/api/media/:messageId/:index', async (req, res) => {
  try {
    const { messageId } = req.params;
    const idx = Number(req.params.index);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: 'invalid index' });
    }

    const userId = req.user?.id;
    const orgIdHeader = req.header('X-Org-Id');
    if (!userId || !orgIdHeader) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const messageOrg = await getMessageOrg(messageId);
    if (!messageOrg) return res.status(404).json({ error: 'message not found' });
    if (messageOrg !== orgIdHeader) return res.status(403).json({ error: 'forbidden' });

    const ok = await userHasAccessToOrg(userId, messageOrg);
    if (!ok) return res.status(403).json({ error: 'forbidden' });

    const att = await getAttachmentByMessageIdx(messageId, idx);
    if (!att) return res.status(404).json({ error: 'attachment not found' });

    if (att.storage_provider === 's3') {
      const url = await getPresignedOrPublic({ pathOrKey: att.path_or_key, expiresSec: 300 });
      if (!url) return res.status(500).json({ error: 's3 not configured' });
      return res.redirect(302, url);
    }

    // local
    const base = path.resolve(process.env.MEDIA_LOCAL_DIR || './storage');
    const file = path.resolve(path.join(base, 'blobs', att.path_or_key.replace(/^blobs\//, '')));
    if (!file.startsWith(base)) return res.status(403).json({ error: 'forbidden' }); // anti path traversal
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'file not found' });

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(file);
  } catch (err) {
    log.error({ err }, 'media-route-error');
    return res.status(500).json({ error: 'internal' });
  }
});

export default router;
