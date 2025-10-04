import inboxApi from "../../../api/inboxApi.js";
import { createEmitter } from "../events.js";
import cloudTransport from "./transport-cloud.js";
import baileysTransport from "./transport-baileys.js";
import { retry } from "../../../lib/retry.js";
import { newIdempotencyKey } from "../../../lib/idempotency.js";

function createBusProxy(provided) {
  const fallback = provided || createEmitter();
  const getBus = () => {
    if (provided) return provided;
    return inboxApi?.__mock?.waBus?.() || fallback;
  };

  return {
    on(evt, cb) {
      const target = getBus();
      if (!target?.on) return () => {};
      return target.on(evt, cb);
    },
    off(evt, cb) {
      const target = getBus();
      target?.off?.(evt, cb);
    },
    emit(evt, payload) {
      const target = getBus();
      target?.emit?.(evt, payload);
    },
    clear() {
      const target = getBus();
      target?.clear?.();
    },
  };
}

export function createWhatsAppClient({ transport = "cloud", bus: providedBus } = {}) {
  const bus = createBusProxy(providedBus);
  const ctx = { bus, retry, newIdempotencyKey };

  const t = transport === "baileys" ? baileysTransport(ctx) : cloudTransport(ctx);

  return {
    transport: t.name,
    ...t,
    bus,
  };
}
