import inboxApi from "../../../api/inboxApi.js";
import { normalizeMessage, normalizeStatus, normalizeTyping } from "../normalize.js";
import { retry } from "../../../lib/retry.js";
import { newIdempotencyKey } from "../../../lib/idempotency.js";
import { audit } from "../../../lib/audit.js";
import { track } from "../../../lib/analytics.js";

const shouldRetry = (err) => {
  const status = Number(err?.status ?? err?.response?.status);
  return err?.name !== "AbortError" && [429, 502, 503, 504].includes(status);
};

const withIdempotencyHeader = (key) => ({ "Idempotency-Key": key });

export default function cloudTransport({ bus }) {
  return {
    name: "cloud",
    async sendText({ to, text, chatId, signal, idempotencyKey } = {}) {
      const key = idempotencyKey || newIdempotencyKey();
      const call = () =>
        inboxApi.post(
          "/whatsapp/cloud/send",
          { to, text, chatId },
          { headers: withIdempotencyHeader(key), signal }
        );
      let last;
      try {
        const res = await retry(
          async ({ attempt }) => {
            track("wa_send_attempt", { transport: "cloud", attempt });
            await audit("whatsapp.send.attempt", { transport: "cloud", attempt, chatId, to });
            last = await call();
            return last;
          },
          { retries: 3, baseMs: 250, maxMs: 2000, factor: 2, jitter: true, signal, classify: shouldRetry }
        );
        await audit("whatsapp.send.success", {
          transport: "cloud",
          chatId,
          to,
          idempotency: last?.data?.idempotency ?? key ?? null,
        });
        return normalizeMessage(res.data.message);
      } catch (err) {
        if (err?.name === "AbortError") {
          await audit("whatsapp.send.abort", {
            transport: "cloud",
            chatId,
            to,
            idempotency: key ?? null,
          });
        } else {
          const status = Number(err?.status ?? err?.response?.status);
          await audit("whatsapp.send.error", {
            transport: "cloud",
            chatId,
            to,
            status: Number.isFinite(status) ? status : null,
            idempotency: key ?? null,
          });
        }
        throw err;
      }
    },
    async sendMedia({ to, media, caption, chatId, signal, idempotencyKey } = {}) {
      const key = idempotencyKey || newIdempotencyKey();
      const call = () =>
        inboxApi.post(
          "/whatsapp/cloud/sendMedia",
          { to, media, caption, chatId },
          { headers: withIdempotencyHeader(key), signal }
        );
      let last;
      try {
        const res = await retry(
          async ({ attempt }) => {
            track("wa_send_media_attempt", { transport: "cloud", attempt });
            await audit("whatsapp.send.attempt", { transport: "cloud", attempt, chatId, to, kind: "media" });
            last = await call();
            return last;
          },
          { retries: 3, baseMs: 250, maxMs: 2000, factor: 2, jitter: true, signal, classify: shouldRetry }
        );
        await audit("whatsapp.send.success", {
          transport: "cloud",
          chatId,
          to,
          kind: "media",
          idempotency: last?.data?.idempotency ?? key ?? null,
        });
        return normalizeMessage(res.data.message);
      } catch (err) {
        if (err?.name === "AbortError") {
          await audit("whatsapp.send.abort", {
            transport: "cloud",
            chatId,
            to,
            kind: "media",
            idempotency: key ?? null,
          });
        } else {
          const status = Number(err?.status ?? err?.response?.status);
          await audit("whatsapp.send.error", {
            transport: "cloud",
            chatId,
            to,
            kind: "media",
            status: Number.isFinite(status) ? status : null,
            idempotency: key ?? null,
          });
        }
        throw err;
      }
    },
    async markRead({ chatId, messageId, signal } = {}) {
      const key = newIdempotencyKey();
      const { data } = await retry(
        () =>
          inboxApi.post(
            "/whatsapp/cloud/markRead",
            { chatId, messageId },
            { headers: withIdempotencyHeader(key), signal }
          ),
        { retries: 2, baseMs: 200, factor: 2, jitter: true, signal, classify: shouldRetry }
      );
      return data?.ok === true;
    },
    async setTyping({ chatId, state, signal } = {}) {
      const key = newIdempotencyKey();
      const { data } = await retry(
        () =>
          inboxApi.post(
            "/whatsapp/cloud/typing",
            { chatId, state },
            { headers: withIdempotencyHeader(key), signal }
          ),
        { retries: 1, baseMs: 150, factor: 2, jitter: true, signal, classify: shouldRetry }
      );
      return data?.ok === true;
    },
    async fetchHistory({ chatId, limit = 20, cursor = null }) {
      const { data } = await inboxApi.get(
        `/whatsapp/cloud/history?chatId=${encodeURIComponent(chatId)}&limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`
      );
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
