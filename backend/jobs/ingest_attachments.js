import { fetchAndStore } from '../services/media/store.js';
import { getInboxRepo } from '../services/inbox/repo.js';

function resolveRemoteUrl(att = {}) {
  return att.remote_url || att.url || null;
}

export async function processAttachmentDownload({ messageId, attachments = [], orgId, token }) {
  if (!messageId || !Array.isArray(attachments) || attachments.length === 0) return;
  const repo = getInboxRepo();
  const next = [];
  let changed = false;

  for (const att of attachments) {
    if (!att || att.storage_key) {
      next.push(att);
      continue;
    }
    const remoteUrl = resolveRemoteUrl(att);
    if (!remoteUrl) {
      next.push(att);
      continue;
    }

    try {
      const stored = await fetchAndStore(remoteUrl, token, orgId);
      next.push({
        ...att,
        storage_key: stored.storage_key,
        mime: att.mime || stored.mime || null,
        size: att.size || stored.size || null,
      });
      changed = true;
    } catch (err) {
      next.push({ ...att, download_error: true });
    }
  }

  if (changed) {
    await repo.updateMessageAttachments(messageId, next);
  }
}

export async function enqueueAttachmentDownload(payload) {
  // Fila simples por enquanto – no futuro trocar por worker real
  await processAttachmentDownload(payload || {});
}

export default { enqueueAttachmentDownload, processAttachmentDownload };
