export function isRequired(str) {
  return !!(str || '').trim();
}

export function isEmail(str) {
  if (!str) return false;
  return /.+@.+\..+/.test(str);
}

export function isE164(str) {
  if (!str) return false;
  return /^\+?[1-9]\d{6,14}$/.test(str);
}

export default {
  isRequired,
  isEmail,
  isE164,
};
