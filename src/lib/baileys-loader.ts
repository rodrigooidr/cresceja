// Loader resiliente para @whiskeysockets/baileys (funciona com CJS/ESM e
// inclusive quando o módulo inteiro é uma função).
type BaileysAny = any;

function tryRequire(): BaileysAny | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@whiskeysockets/baileys");
  } catch {
    return null;
  }
}

export function loadBaileysUnsafe() {
  const mod: BaileysAny = tryRequire();
  if (!mod) {
    throw new Error(
      "Não foi possível carregar @whiskeysockets/baileys via require(). " +
        "Certifique-se de que o pacote está instalado no backend."
    );
  }

  // Candidatos para a função makeWASocket, cobrindo todos os formatos:
  const candidates = [
    mod?.makeWASocket, // CJS: named export
    mod?.default?.makeWASocket, // ESM transp.: função dentro de default
    typeof mod?.default === "function" ? mod.default : undefined, // default é a função
    typeof mod === "function" ? mod : undefined, // módulo inteiro é a função
  ].filter((f) => typeof f === "function");

  const makeWASocket = candidates[0];

  // Mesma lógica para utilitários usados pelo serviço
  const useMultiFileAuthState =
    mod?.useMultiFileAuthState ?? mod?.default?.useMultiFileAuthState;
  const DisconnectReason =
    mod?.DisconnectReason ?? mod?.default?.DisconnectReason;

  if (typeof makeWASocket !== "function") {
    const keys = Object.keys(mod || {});
    const defKeys = Object.keys(mod?.default || {});
    throw new Error(
      `Baileys import error: makeWASocket não encontrado. keys=[${keys.join(",")}] defaultKeys=[${defKeys.join(",")}]`
    );
  }
  if (typeof useMultiFileAuthState !== "function") {
    throw new Error("Baileys import error: useMultiFileAuthState não encontrado.");
  }

  return { makeWASocket, useMultiFileAuthState, DisconnectReason };
}
