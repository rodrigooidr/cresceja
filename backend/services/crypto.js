import crypto from 'crypto';

// Preferir chave neutra do produto
const currentRaw = process.env.CRESCEJA_ENC_KEY || '';
// Legado (deprecado): mantém só para ler dados antigos
const legacyRaw  = process.env.GOOGLE_TOKEN_ENC_KEY || '';

// Loga aviso se estiver caindo no legado (somente fora de produção)
if (!currentRaw && legacyRaw && process.env.NODE_ENV !== 'production') {
  console.warn('[crypto] GOOGLE_TOKEN_ENC_KEY is deprecated; use CRESCEJA_ENC_KEY');
}

// Util: aceitar base64/hex/utf8; retornar Buffer
function toKey(raw) {
  if (!raw) return Buffer.alloc(0);
  // base64 (44 chars comuns para 32 bytes) → tenta primeiro
  try { const b = Buffer.from(raw, 'base64'); if (b.length === 32) return b; } catch {}
  // hex (64 chars para 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  // utf8 (32 chars exatos)
  const b = Buffer.from(raw, 'utf8');
  return b;
}

const KEY_CURRENT = toKey(currentRaw);
const KEY_LEGACY  = toKey(legacyRaw);

// Em produção, falhar se não houver chave válida de 32 bytes
if (process.env.NODE_ENV === 'production') {
  if (KEY_CURRENT.length !== 32 && KEY_LEGACY.length !== 32) {
    console.error('[crypto] Missing 32-byte CRESCEJA_ENC_KEY (preferred) or legacy GOOGLE_TOKEN_ENC_KEY');
    process.exit(1);
  }
}

// Versões de cifra (casam com a coluna enc_ver no DB)
export const ENC_VER_CURRENT = 2; // CRESCEJA_ENC_KEY
export const ENC_VER_LEGACY  = 1; // GOOGLE_TOKEN_ENC_KEY (antiga)

// AES-256-GCM (iv 12 bytes, tag 16 bytes)
export function encrypt(plain) {
  const key = KEY_CURRENT.length === 32 ? KEY_CURRENT : KEY_LEGACY; // só por garantia
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const pack = Buffer.concat([iv, tag, enc]).toString('base64');
  return { c: pack, v: (key === KEY_CURRENT ? ENC_VER_CURRENT : ENC_VER_LEGACY) };
}

export function decrypt({ c, v }) {
  const buf = Buffer.from(c, 'base64');
  const iv  = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);

  // escolhe a chave conforme a versão; faz fallback se preciso
  const tryKeys = (v === ENC_VER_CURRENT) ? [KEY_CURRENT, KEY_LEGACY] :
                  (v === ENC_VER_LEGACY) ? [KEY_LEGACY, KEY_CURRENT] :
                                           [KEY_CURRENT, KEY_LEGACY];

  for (const key of tryKeys) {
    if (key.length !== 32) continue;
    try {
      const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
      dec.setAuthTag(tag);
      const out = Buffer.concat([dec.update(enc), dec.final()]);
      return out.toString('utf8');
    } catch { /* tenta próxima chave */ }
  }
  throw new Error('decrypt_failed'); // chave(s) incorreta(s) ou payload inválido
}

export default { encrypt, decrypt, ENC_VER_CURRENT, ENC_VER_LEGACY };
