import { encrypt, decrypt } from '#crypto';

export function seal(obj) {
  const payload = obj && typeof obj === 'object' ? obj : {};
  return encrypt(JSON.stringify(payload));
}

export function open(blob) {
  if (!blob) return {};
  if (typeof blob !== 'object') return {};
  if (!('c' in blob) || !('v' in blob)) {
    if (typeof blob === 'string') {
      try {
        return JSON.parse(blob);
      } catch (_err) {
        return {};
      }
    }
    return { ...blob };
  }
  try {
    const json = decrypt(blob);
    return JSON.parse(json);
  } catch (_err) {
    return {};
  }
}

export default { seal, open };
