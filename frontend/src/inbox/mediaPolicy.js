export {
  canSendImages,
  canSendFiles,
  detectKind,
  validateFile,
  __testHooks,
} from '../policies/mediaPolicy';

export const MAX_UPLOAD_MB = 15;

export const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'application/pdf'];

export function isAllowed(file) {
  if (!file || !file.type) return false;
  return ALLOWED_MIME_PREFIXES.some((p) => file.type.startsWith(p));
}

export function exceedsSize(file, maxMb = MAX_UPLOAD_MB) {
  if (!file || typeof file.size !== 'number') return true;
  return file.size > maxMb * 1024 * 1024;
}

export function violationMessage(file) {
  if (exceedsSize(file)) return `Arquivo “${file.name}” excede ${MAX_UPLOAD_MB}MB.`;
  if (!isAllowed(file)) return `Tipo não permitido: ${file.type || 'desconhecido'}.`;
  return '';
}
