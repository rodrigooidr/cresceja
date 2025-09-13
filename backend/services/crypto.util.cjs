const crypto = require('crypto');
const KEY = (process.env.GOOGLE_TOKEN_ENC_KEY || '').slice(0, 32); // 32 bytes

function encrypt(plain) {
  if (!KEY) return { c: Buffer.from(plain, 'utf8').toString('base64'), v: 0 };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(KEY), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { c: Buffer.concat([iv, tag, enc]).toString('base64'), v: 1 };
}
function decrypt(pack) {
  try {
    const { c, v } = pack || {};
    if (!v) return Buffer.from(c, 'base64').toString('utf8');
    const buf = Buffer.from(c, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(KEY), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch { return ''; }
}

module.exports = { encrypt, decrypt };
