export function canSendImages() {
  return true;
}

export function canSendFiles() {
  return true;
}
export function detectKind() {
  return 'image';
}

export async function validateFile() {
  return { ok: true };
}

export const __testHooks = { reset() {}, setResolvers() {} };

export default { canSendImages, canSendFiles, detectKind, validateFile, __testHooks };
