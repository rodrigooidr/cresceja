import inboxApi from "../../../api/inboxApi.js";
import { normalizeMessage, normalizeStatus, normalizeTyping } from "../normalize.js";

const RETRY_DEFAULTS = {
  retries: 3,
  baseMs: 250,
  maxMs: 2000,
  factor: 2,
  jitter: true,
};

function shouldRetry(error) {
  if (!error) return false;
  if (error?.name === "AbortError") return false;
  const status = Number(error?.status ?? error?.response?.status);
  if (!Number.isFinite(status)) return false;
  return status === 429 || (status >= 500 && status < 600);
}

export default function cloudTransport({ bus, retry, newIdempotencyKey }) {
  const runWithRetry = async (fn, opts = {}) => {
    if (typeof retry !== "function") {
      return fn();
    }
    return retry(() => fn(), {
      ...RETRY_DEFAULTS,
      ...opts,
      classify: opts.classify || shouldRetry,
    });
  };

  const buildHeaders = () => {
    const key = newIdempotencyKey?.();
    return key ? { "Idempotency-Key": key } : {};
  };

  return {
    name: "cloud",
    async sendText({ to, text, chatId }) {
      const headers = buildHeaders();
      const request = () => inboxApi.post(
        "/whatsapp/cloud/send",
        { to, text, chatId },
        { headers }
      );
      const { data } = await runWithRetry(request);
      return normalizeMessage(data.message);
    },
    async sendMedia({ to, media, caption, chatId }) {
      const headers = buildHeaders();
      const request = () => inboxApi.post(
        "/whatsapp/cloud/sendMedia",
        { to, media, caption, chatId },
        { headers }
      );
      const { data } = await runWithRetry(request);
      return normalizeMessage(data.message);
    },
    async markRead({ chatId, messageId }) {
      const headers = buildHeaders();
      const request = () => inboxApi.post(
        "/whatsapp/cloud/markRead",
        { chatId, messageId },
        { headers }
      );
      const { data } = await runWithRetry(request);
      return data?.ok === true;
    },
    async setTyping({ chatId, state }) {
      const headers = buildHeaders();
      const request = () => inboxApi.post(
        "/whatsapp/cloud/typing",
        { chatId, state },
        { headers }
      );
      const { data } = await runWithRetry(request);
      return data?.ok === true;
    },
    async fetchHistory({ chatId, limit = 20, cursor = null }) {
      const request = () => inboxApi.get(
        `/whatsapp/cloud/history?chatId=${encodeURIComponent(chatId)}&limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`
      );
      const { data } = await runWithRetry(request);
      return { items: data.items.map(normalizeMessage), nextCursor: data.nextCursor || null };
    },
    on(event, cb) {
      if (!bus) return () => {};
      if (event === "status") return bus.on("wa:status", (p) => cb(normalizeStatus(p)));
      if (event === "typing") return bus.on("wa:typing", (p) => cb(normalizeTyping(p)));
      if (event === "message") return bus.on("wa:message", (p) => cb(normalizeMessage(p)));
      return () => {};
    },
    off() {
      /* noop */
    },
  };
}
