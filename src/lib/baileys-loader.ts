// src/lib/baileys-loader.ts
// Loader resiliente p/ ESM e CJS, pega a função certa e exporta utilitários.
type BaileysModule = any;

function pickMake(mod: BaileysModule) {
  const cands = [
    mod?.makeWASocket,            // CJS com named export
    mod?.default?.makeWASocket,   // ESM transp. que põe tudo em default
    mod?.default,                 // ESM com default = makeWASocket
  ].filter((f) => typeof f === "function");
  return cands[0];
}

function pick<T = any>(mod: BaileysModule, name: string): T | undefined {
  return mod?.[name] ?? mod?.default?.[name];
}

export async function loadBaileysUnsafe() {
  // Tenta require (CJS) e cai para import() (ESM) se necessário
  let mod: BaileysModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require("@whiskeysockets/baileys");
  } catch {
    // @ts-ignore
    mod = (await import("@whiskeysockets/baileys")) as BaileysModule;
  }

  const makeWASocket = pickMake(mod);
  if (typeof makeWASocket !== "function") {
    const keys = Object.keys(mod || {});
    const defKeys = Object.keys(mod?.default || {});
    throw new Error(
      `Baileys import failed: makeWASocket not found. keys=${keys.join(",")} defaultKeys=${defKeys.join(",")}`
    );
  }

  const useMultiFileAuthState = pick(mod, "useMultiFileAuthState");
  const DisconnectReason = pick(mod, "DisconnectReason");

  if (typeof useMultiFileAuthState !== "function") {
    throw new Error("Baileys import failed: useMultiFileAuthState not found.");
  }

  return { makeWASocket, useMultiFileAuthState, DisconnectReason };
}
