import crypto from 'crypto';

// Prefer the new CRESCEJA_ENC_KEY, but allow legacy GOOGLE_TOKEN_ENC_KEY
// for backward compatibility. A warning is emitted when falling back.
const legacyKey = process.env.GOOGLE_TOKEN_ENC_KEY;
const secret = process.env.CRESCEJA_ENC_KEY || legacyKey || '';

if (!process.env.CRESCEJA_ENC_KEY && legacyKey) {
  console.warn('GOOGLE_TOKEN_ENC_KEY is deprecated; use CRESCEJA_ENC_KEY');
}

const key = Buffer.from(secret, 'utf8');

if (process.env.NODE_ENV === 'production') {
  if (key.length !== 32) {
    console.error('CRESCEJA_ENC_KEY must be 32 bytes');
    process.exit(1);
  }
} else if (key.length !== 32) {
  console.warn('CRESCEJA_ENC_KEY must be 32 bytes');
}

export function encrypt(data) {
  if (!data) return null;
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(str) {
  if (!str) return null;
  const buf = Buffer.from(str, 'base64');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const data = buf.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

export default { encrypt, decrypt };
