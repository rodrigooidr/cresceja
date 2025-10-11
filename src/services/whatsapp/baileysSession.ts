import makeWASocket, { DisconnectReason, useMultiFileAuthState, WASocket, ConnectionState } from "@whiskeysockets/baileys";
import Pino from "pino";

export type QrStreamHandlers = {
  onQr: (qr: string) => void;
  onStatus?: (status: string) => void;
  onConnected?: () => void;
  onError?: (err: Error) => void;
};

type StartOpts = {
  orgId: string;
  sessionId: string;
} & QrStreamHandlers;

const logger = Pino({ level: process.env.WA_LOG_LEVEL ?? "info" });

// Mantém 1 instância por org/session
const sockets: Record<string, { sock: WASocket; stop: () => Promise<void> }> = {};

export async function startBaileysQrStream(opts: StartOpts) {
  const { orgId, sessionId, onQr, onStatus, onConnected, onError } = opts;
  const key = `${orgId}:${sessionId}`;

  // Se já existir, só reaproveite (vai continuar emitindo status/qr)
  if (sockets[key]) {
    onStatus?.("already_running");
    return () => sockets[key]?.stop?.();
  }

  let stopped = false;

  const { state, saveCreds } = await useMultiFileAuthState(`./.wa-auth/${orgId}/${sessionId}`);

  const buildSock = () =>
    makeWASocket({
      printQRInTerminal: false, // a gente emite via callback
      browser: ["CresceJa", "Chrome", "1.0"],
      logger,
      auth: state,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

  let sock = buildSock();

  const stop = async () => {
    stopped = true;
    try { await sock?.logout?.(); } catch {}
    try { sock?.end?.(); } catch {}
    delete sockets[key];
  };

  sockets[key] = { sock, stop };

  const restart = () => {
    if (stopped) return;
    try { sock?.end?.(); } catch {}
    sock = buildSock();
    sockets[key].sock = sock;
    wire();
    onStatus?.("restarting");
  };

  const wire = () => {
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = u;

      if (qr) {
        // Emite SEMPRE que o Baileys renovar o QR
        onQr(qr);
        onStatus?.("qr_issued");
      }

      if (connection === "open") {
        onStatus?.("connected");
        onConnected?.();
      }

      if (connection === "close") {
        const reason = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
        // Casos comuns:
        // - 403 / 401 cred invalida
        // - "QR refs attempts ended": precisamos reiniciar para gerar novo QR
        const msg = (lastDisconnect?.error as Error)?.message ?? String(lastDisconnect?.error);

        // Regerar sessão/QR sempre que cair, exceto se mandarmos parar
        if (!stopped) {
          logger.info({ class: "baileys", reason, msg }, "connection closed, restarting");
          onStatus?.("restarting_after_close");
          setTimeout(restart, 1000);
        }
      }
    });

    // Esse evento aparece quando o Baileys para de gerar QR (“QR refs attempts ended”).
    // Ao ouvir um erro desses, reiniciamos para emitir novo QR.
    sock.ev.on("connection.error", (err) => {
      const e = err as Error;
      if (e?.message?.includes("QR refs attempts ended")) {
        onStatus?.("qr_attempts_ended_restart");
        return restart();
      }
      onError?.(e);
    });
  };

  wire();

  return stop;
}
