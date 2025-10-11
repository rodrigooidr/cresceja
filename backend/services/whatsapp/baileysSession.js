import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import Pino from "pino";

const logger = Pino({ level: process.env.WA_LOG_LEVEL ?? "info" });

/** @type {Record<string, { sock: import("@whiskeysockets/baileys").WASocket; stop: () => Promise<void> }>} */
const sockets = {};

/**
 * @param {{
 *  orgId: string;
 *  sessionId: string;
 *  onQr: (qr: string) => void;
 *  onStatus?: (status: string) => void;
 *  onConnected?: () => void;
 *  onError?: (err: Error) => void;
 * }} opts
 */
export async function startBaileysQrStream(opts) {
  const { orgId, sessionId, onQr, onStatus, onConnected, onError } = opts;
  const key = `${orgId}:${sessionId}`;

  if (sockets[key]) {
    onStatus?.("already_running");
    return () => sockets[key]?.stop?.();
  }

  let stopped = false;

  const { state, saveCreds } = await useMultiFileAuthState(`./.wa-auth/${orgId}/${sessionId}`);

  const buildSock = () =>
    makeWASocket({
      printQRInTerminal: false,
      browser: ["CresceJa", "Chrome", "1.0"],
      logger,
      auth: state,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

  let sock = buildSock();

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try {
      await sock?.logout?.();
    } catch (err) {
      logger.debug?.({ err }, "baileys_stop_logout_error");
    }
    try {
      sock?.ev?.removeAllListeners?.();
    } catch {}
    try {
      sock?.end?.();
    } catch {}
    delete sockets[key];
  };

  sockets[key] = { sock, stop };

  function restart() {
    if (stopped) return;
    try {
      sock?.end?.();
    } catch {}
    sock = buildSock();
    sockets[key].sock = sock;
    wire();
    onStatus?.("restarting");
  }

  function wire() {
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update || {};

      if (qr) {
        const value = typeof qr === "string" ? qr : String(qr);
        logger.info({ class: "WA", len: value.length }, "QR_ISSUED");
        try {
          onQr?.(qr);
          onStatus?.("qr_issued");
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }

      if (connection === "open") {
        logger.info({ class: "WA" }, "OPEN");
        onStatus?.("connected");
        try {
          onConnected?.();
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }

      if (connection === "close") {
        const lastError = lastDisconnect?.error;
        const reason = lastError?.output?.statusCode || lastError?.statusCode;
        const msg = lastError instanceof Error ? lastError.message : String(lastError ?? "");

        logger.info({ class: "WA", msg }, "CLOSE");
        if (!stopped) {
          logger.info({ class: "baileys", reason, msg }, "connection closed, restarting");
          onStatus?.("restarting_after_close");
          setTimeout(restart, 1000);
        }
      }
    });

    sock.ev.on("connection.error", (err) => {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.info({ class: "WA", msg: error?.message }, "ERROR");
      if (error.message?.includes?.("QR refs attempts ended")) {
        onStatus?.("qr_attempts_ended_restart");
        return restart();
      }
      onError?.(error);
    });
  }

  wire();

  return stop;
}
